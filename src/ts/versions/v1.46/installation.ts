import {KubeApply, LocalManifest} from '../../plugins/KubeApply';
import {Flow, Step, VersionedValues} from '../../flow/Flow';
import {Installation as IInstallation, InstallationConfig, InstallationState} from '../installations';
import {HelmTaskFactory} from '../../flow/HelmTask';
import {KubeApplyFactory} from '../../flow/KubeApplyTask';
import {Helm} from '../../plugins/Helm';
import {VersionedState} from '../../Landscape';
import {createLogger} from '../../log/Logger';
import {KubeClient} from '../../utils/KubeClient';
import {ExportVirtualClusterAdminKubeconfig} from './tasks/ExportApiserverKubeconfig';
import {emptyState, GeneralValues, generateGardenerInstallationValues} from './Values';
import {NginxIngressChart} from './components/charts/NginxIngressChart';
import {CertManagerChart} from './components/charts/CertManagerChart';
import {DnsControllerChart} from './components/charts/DnsControllerChart';
import {HostConfigurationChart} from './components/charts/HostConfigurationChart';
import {NetworkPoliciesChart} from './components/charts/NetworkPoliciesChart';
import {IdentityChart} from './components/charts/IdentityChart';
import {EtcdEventsChart, EtcdMainChart} from './components/charts/EtcdChart';
import {VirtualClusterChart} from './components/charts/VirtualClusterChart';
import {Gardener} from './components/gardener/Gardener';
import {GardenerExtensions} from './components/GardenerExtensions';
import {GardenerDashboardChart} from './components/charts/GardenerDashboardChart';
import {GardenerInitConfigTask} from './components/GardenerInitConfig';

export const VERSION = '1.46';

const log = createLogger('');

export class Installation implements IInstallation {

    public constructor(
        protected readonly state: InstallationState,
        protected readonly kubeClient: KubeClient,
        protected readonly helm: Helm,
        protected readonly kubeApply: KubeApply,
        protected readonly config: InstallationConfig,
    ) {}

    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(inputValues.version);
        }
        
        console.log('aaaa', stateValues.apiserver.version);
        const values = await generateGardenerInstallationValues(stateValues, inputValues);
        console.log('aaaa', values.apiserver.version);
        await this.state.store(stateValues, inputValues);
        log.info('Successfully stored state');

        flow.addSteps(...await this.constructPreVirtualClusterFlow(values));
        await flow.execute();

        // need to wait for virtual cluster creation because some steps afterwards already depend on the virtual cluster.
        flow.addSteps(...await this.constructPostVirtualClusterFlow(values));
        await flow.execute();
    }

    protected async constructPreVirtualClusterFlow(values: GeneralValues): Promise<Step[]> {
        const helmTaskFactory = new HelmTaskFactory(values, this.helm);
        const kubeApplyFactory = new KubeApplyFactory(this.kubeApply);

       return [
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
        ];
    }

    protected async constructPostVirtualClusterFlow(values: GeneralValues): Promise<Step[]> {
        const helmTaskFactory = new HelmTaskFactory(values, this.helm);
        const kubeApplyFactory = new KubeApplyFactory(this.kubeApply);

        return [
            new ExportVirtualClusterAdminKubeconfig(
                this.kubeClient,
                values,
                this.config.genDir,
                this.config.dryRun,
            ),
            ...(await Gardener(
                values.version,
                this.kubeClient,
                this.helm,
                values,
                this.config.dryRun,
            )),
            await GardenerExtensions(kubeApplyFactory, values, this.config.genDir, this.config.dryRun),
            helmTaskFactory.createTask(new GardenerDashboardChart(this.config.dryRun)),
            new GardenerInitConfigTask(this.helm, values, this.config.dryRun),
        ];
    }
}
