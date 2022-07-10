import {KubeApply, LocalManifest} from '../../plugins/KubeApply';
import {Flow, VersionedValues} from '../../flow/Flow';
import {Installation as IInstallation, InstallationConfig, InstallationState} from '../installations';
import {HelmTaskFactory} from '../../flow/HelmTask';
import {KubeApplyFactory} from '../../flow/KubeApplyTask';
import {Helm} from '../../plugins/Helm';
import {VersionedState} from '../../Landscape';
import {createLogger} from '../../log/Logger';
import {KubeClient} from '../../utils/KubeClient';
import {ExportVirtualClusterAdminKubeconfig} from './tasks/ExportApiserverKubeconfig';
import {emptyState, generateGardenerInstallationValues} from './Values';
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
        private readonly state: InstallationState,
        private readonly kubeClient: KubeClient,
        private readonly helm: Helm,
        private readonly kubeApply: KubeApply,
        private readonly config: InstallationConfig,
    ) {}

    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(inputValues.version);
        }
        const values = await generateGardenerInstallationValues(stateValues, inputValues);
        await this.state.store(values);
        log.info('Successfully stored state');

        const helmTaskFactory = new HelmTaskFactory(values, this.helm);
        const kubeApplyFactory = new KubeApplyFactory(this.kubeApply);

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
        );
        await flow.execute();

        // need to wait for virtual cluster creation because some steps afterwards already depend on the virtual cluster.
        flow.addSteps(
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
        );
        await flow.execute();
    }
}
