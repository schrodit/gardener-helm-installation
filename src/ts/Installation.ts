import {mkdir, readFile, writeFile, access} from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import {KubeConfig} from '@kubernetes/client-node';
import {IdentityChart} from '../charts/host/identity/Chart';
import {NginxIngressChart} from '../charts/host/NginxIngressChart';
import {NetworkPoliciesChart} from '../charts/host/network-policies/Chart';
import {CertManagerChart} from '../charts/host/CertManagerChart';
import {DnsControllerChart} from '../charts/host/external-dns-management/Chart';
import {HostConfigurationChart} from '../charts/host/configuration/Chart';
import {EtcdEventsChart, EtcdMainChart} from '../charts/host/etcd/Chart';
import {VirtualClusterChart} from '../charts/host/virtual-cluster/Chart';
import {GardenerDashboardChart} from '../charts/host/gardener-dashboard/Chart';
import {Helm, InstalledRelease} from './plugins/Helm';
import {DefaultNamespace, emptyStateFile, generateGardenerInstallationValues, StateValues} from './Values';
import {KeyValueState, State} from './state/State';
import {LocalKeyValueState, LocalState} from './state/LocalState';
import {deepMergeObject} from './utils/deepMerge';
import {KubernetesKeyValueState, KubernetesState} from './state/KubernetesState';
import {DefaultKubeClient} from './utils/DefaultKubeClient';
import {createLogger} from './log/Logger';
import {KubeApply, ManagedResources, LocalManifest} from './plugins/KubeApply';
import {KubeClient} from './utils/KubeClient';
import {Flow} from './flow/Flow';
import {HelmTaskFactory} from './flow/HelmTask';
import {KubeApplyFactory} from './flow/KubeApplyTask';
import {ExportVirtualClusterAdminKubeconfig} from './tasks/ExportApiserverKubeconfig';
import {Gardener} from './components/Gardener';
import {GardenerExtensionsTask} from './components/GardenerExtensions';

const log = createLogger('Installation');

export interface InstallationConfig {
    dryRun: boolean;
    defaultNamespace: string;
    valueFiles: string[];
}

const defaultValuesFile = './default.yaml';
const extensionsValuesFile = './extensions.yaml';
const genDir = './gen';
const stateFile = './state/state.yaml';
const helmStateFile = './state/helm-state.yaml';
const kubeApplyStateFile = './state/kube-apply-state.yaml';

export class Installation {

    private readonly helm: Helm;
    private readonly kubeApply: KubeApply;

    private constructor(
        private readonly kubeClient: KubeClient,
        private readonly config: InstallationConfig,
        private readonly state: State<StateValues>,
        helmState: KeyValueState<InstalledRelease>,
        kubeApplyState: KeyValueState<ManagedResources[]>,
    ) {
        this.helm = new Helm(
            genDir,
            helmState,
            config.dryRun,
            config.defaultNamespace,
        );
        this.kubeApply = new KubeApply(
            kubeClient,
            kubeApplyState,
            config.dryRun,
            config.defaultNamespace,
        );
    }

    public static async run(config: InstallationConfig): Promise<Installation> {
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
        config.valueFiles = [defaultValuesFile, extensionsValuesFile].concat(config.valueFiles);
        const inst = new Installation(kubeClient, config, state, helmState, kubeApplyState);

        await inst.install();
        return inst;
    }

    private async install(): Promise<void> {
        const values = await generateGardenerInstallationValues(this.state, await this.readValueFiles());
        await this.writeToGen('values.yaml', yaml.stringify(values));

        const helmTaskFactory = new HelmTaskFactory(values, this.helm);
        const kubeApplyFactory = new KubeApplyFactory(this.kubeApply);
        const flow = new Flow();
        flow.addTasks(
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
                this.config.dryRun,
            ),
            new Gardener(
                this.kubeClient,
                this.helm,
                values,
                this.config.dryRun,
            ),
            new GardenerExtensionsTask(kubeApplyFactory, values, genDir, this.config.dryRun),
            helmTaskFactory.createTask(new GardenerDashboardChart()),
        );

        await flow.execute();
    }

    private async readValueFiles(): Promise<any> {
        const allValues = await Promise.all(
            this.config.valueFiles.map(path => this.readValues(path))
        );
        let val = {};
        allValues.forEach( v => {
            val = deepMergeObject(val, v);
        });
        return val;
    }

    private async readValues(path: string): Promise<any> {
        log.info(`Read values from ${path}`);
        return yaml.parse(await readFile(path, 'utf-8'));
    }

    private async writeToGen(filename: string, content: string): Promise<void> {
        try {
            await access(genDir);
        } catch (error) {
            await mkdir('./gen');
        }

        await writeFile(path.join(genDir, filename), content);
    }

}

