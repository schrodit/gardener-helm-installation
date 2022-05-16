import {mkdir, readFile, writeFile, access} from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import {KubeConfig} from '@kubernetes/client-node';
import {NginxIngressChart} from './components/charts/NginxIngressChart';
import {CertManagerChart} from './components/charts/CertManagerChart';
import {IdentityChart} from './components/charts/IdentityChart';
import {NetworkPoliciesChart} from './components/charts/NetworkPoliciesChart';
import {DnsControllerChart} from './components/charts/DnsControllerChart';
import {HostConfigurationChart} from './components/charts/HostConfigurationChart';
import {EtcdEventsChart, EtcdMainChart} from './components/charts/EtcdChart';
import {VirtualClusterChart} from './components/charts/VirtualClusterChart';
import {GardenerDashboardChart} from './components/charts/GardenerDashboardChart';
import {Helm, InstalledRelease} from './plugins/Helm';
import {DefaultNamespace, emptyStateFile, generateGardenerInstallationValues, StateValues, InputValues} from './Values';
import {KeyValueState, State} from './state/State';
import {LocalKeyValueState, LocalState} from './state/LocalState';
import {deepMergeObject} from './utils/deepMerge';
import {KubernetesKeyValueState, KubernetesState} from './state/KubernetesState';
import {DefaultKubeClient} from './utils/DefaultKubeClient';
import {createLogger} from './log/Logger';
import {KubeApply, ManagedResources, LocalManifest} from './plugins/KubeApply';
import {KubeClient} from './utils/KubeClient';
import {Flow, StepInfo} from './flow/Flow';
import {HelmTaskFactory} from './flow/HelmTask';
import {KubeApplyFactory} from './flow/KubeApplyTask';
import {ExportVirtualClusterAdminKubeconfig} from './tasks/ExportApiserverKubeconfig';
import {Gardener} from './components/gardener/Gardener';
import {GardenerExtensions} from './components/GardenerExtensions';
import {GardenerInitConfigTask} from './components/GardenerInitConfig';
import {internalFile} from './config';
import {NamespacedKeyValueState} from './state/NamespacedKeyValueState';
import {trimSuffix} from './utils/trimSuffix';

const log = createLogger('Installation');

export interface LandscapeInstallationConfig {
    dryRun?: boolean;
    defaultNamespace?: string;
    valueFiles?: string[];
    values?: InputValues;
}

const defaultValuesFile = './default.yaml';
const extensionsValuesFile = './extensions.yaml';
const genDir = './gen';
const stateFile = './state/state.yaml';
const helmStateFile = './state/helm-state.yaml';
const kubeApplyStateFile = './state/kube-apply-state.yaml';

export class Landscape {

    private readonly helm: Helm;
    private readonly kubeApply: KubeApply;

    private constructor(
        private inputValues: InputValues,
        private readonly kubeClient: KubeClient,
        private readonly dryRun: boolean,
        private readonly defaultNamespace: string,
        private readonly state: State<StateValues>,
        private readonly genericState: KeyValueState<any>,
        helmState: KeyValueState<InstalledRelease>,
        kubeApplyState: KeyValueState<ManagedResources[]>,
    ) {
        this.helm = new Helm(
            genDir,
            helmState,
            this.dryRun,
            this.defaultNamespace,
        );
        this.kubeApply = new KubeApply(
            kubeClient,
            kubeApplyState,
            this.dryRun,
            this.defaultNamespace,
        );
    }

    public static async deploy(config: LandscapeInstallationConfig): Promise<Landscape> {
        const kc = new KubeConfig();
        kc.loadFromDefault();
        const kubeClient = new DefaultKubeClient(kc);

        let state: State<StateValues> = new LocalState<StateValues>(stateFile, emptyStateFile);
        if (!config.dryRun) {
            log.info(`Deploying to ${kc.getCurrentCluster()?.server}`);
            state = new KubernetesState<StateValues>(
                kubeClient,
                'state',
                DefaultNamespace,
                emptyStateFile,
            );
        }

        let genericState: KeyValueState<any> = new LocalKeyValueState<any>(helmStateFile);
        if (!config.dryRun) {
            genericState = new KubernetesKeyValueState<any>(
                kubeClient,
                'kv-state',
                DefaultNamespace,
            );
        }
        let helmState: KeyValueState<InstalledRelease> = new LocalKeyValueState<InstalledRelease>(helmStateFile);
        if (!config.dryRun) {
            helmState = new KubernetesKeyValueState<InstalledRelease>(
                kubeClient,
                'helm-state',
                DefaultNamespace,
            );
        }
        let kubeApplyState: KeyValueState<ManagedResources[]> = new LocalKeyValueState<ManagedResources[]>(kubeApplyStateFile);
        if (!config.dryRun) {
            kubeApplyState = new KubernetesKeyValueState<ManagedResources[]>(
                kubeClient,
                'kube-apply-state',
                DefaultNamespace,
            );
        }

        const valueFiles = [
            internalFile(defaultValuesFile),
            internalFile(extensionsValuesFile),
        ].concat(config.valueFiles ?? []);
        const values = deepMergeObject(
            config.values ?? {},
            await this.readValueFiles(valueFiles),
        );

        config.valueFiles = [
            internalFile(defaultValuesFile),
            internalFile(extensionsValuesFile),
        ].concat(config.valueFiles ?? []);

        const inst = new Landscape(
            values,
            kubeClient,
            config.dryRun ?? false,
            config.defaultNamespace ?? DefaultNamespace,
            state,
            genericState,
            helmState,
            kubeApplyState);

        await inst.install();
        return inst;
    }

    private async install(): Promise<void> {
        const values = await generateGardenerInstallationValues(this.state, this.inputValues);
        await this.writeToGen('values.yaml', yaml.stringify(values));

        const helmTaskFactory = new HelmTaskFactory(values, this.helm);
        const kubeApplyFactory = new KubeApplyFactory(this.kubeApply);
        const flow = new Flow('');
        flow.addSteps(
            kubeApplyFactory.createTask(new LocalManifest('vpa', './src/charts/host/vpa/vpa-crd.yaml')),
            helmTaskFactory.createTask(new NginxIngressChart()),
            helmTaskFactory.createTask(new CertManagerChart()),
            helmTaskFactory.createTask(new DnsControllerChart()),
            helmTaskFactory.createTask(new HostConfigurationChart()),
            helmTaskFactory.createTask(new NetworkPoliciesChart()),
            helmTaskFactory.createTask(new IdentityChart()),
            helmTaskFactory.createTask(new EtcdMainChart()),
            helmTaskFactory.createTask(new EtcdEventsChart()),
            helmTaskFactory.createTask(new VirtualClusterChart()),
            new ExportVirtualClusterAdminKubeconfig(
                this.kubeClient,
                values,
                genDir,
                this.dryRun,
            ),
            ...(await Gardener(
                this.kubeClient,
                this.helm,
                values,
                new NamespacedKeyValueState(this.genericState, 'gardener'),
                this.dryRun,
            )),
            await GardenerExtensions(kubeApplyFactory, values, genDir, this.dryRun),
            helmTaskFactory.createTask(new GardenerDashboardChart(this.dryRun)),
            new GardenerInitConfigTask(this.helm, values, this.dryRun),
        );

        await flow.execute();

        if (this.dryRun) {
            let msg = 'Flow\n';
            flow.getStepInfo().forEach(i => msg += this.printStepInfo(i));
            log.info(msg);
        }
    }

    private async writeToGen(filename: string, content: string): Promise<void> {
        try {
            await access(genDir);
        } catch (error) {
            await mkdir('./gen');
        }

        await writeFile(path.join(genDir, filename), content);
    }

    private static async readValueFiles(valueFiles: string[]): Promise<any> {
        const allValues = await Promise.all(
            valueFiles.map(path => this.readValues(path))
        );
        let val = {};
        allValues.forEach( v => {
            val = deepMergeObject(val, v);
        });
        return val;
    }

    private static async readValues(path: string): Promise<any> {
        log.info(`Read values from ${path}`);
        return yaml.parse(await readFile(path, 'utf-8'));
    }

    private printStepInfo(stepInfo: StepInfo): string {
        const indent = '  ';
        let out = `- ${stepInfo.name}\n`;
        if (stepInfo.steps) {
            let steps = '';
            stepInfo.steps.forEach(i => {
                steps += this.printStepInfo(i);
            });
            steps = steps.replace(/\n/g, '\n  ');
            if (steps.length !== 0) {
                steps = trimSuffix(indent + steps, indent);
            }
            out += steps;
        }
        return out;
    }

}

