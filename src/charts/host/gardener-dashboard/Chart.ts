import {Chart, ChartPath, Values} from '../../../ts/plugins/Helm';
import {GardenerNamespace, GeneralValues} from '../../../ts/Values';
import {waitUntilVirtualClusterIsReady} from '../../../ts/components/VirtualCluster';
import {createLogger} from '../../../ts/log/Logger';

const log = createLogger('GardenerDashboard');

export class GardenerDashboardChart extends Chart {
    constructor(private readonly dryRun: boolean) {
        super(
            'gardener-dashboard',
            new ChartPath('./src/charts/host/gardener-dashboard'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        let kubeconfig = 'dummy';
        if (!this.dryRun) {
            kubeconfig = (await waitUntilVirtualClusterIsReady(log, values)).getKubeConfig().exportConfig();
        }
        return {
            apiServerUrl: values.apiserver.url,
            apiServerCa: values.apiserver.tls.ca.cert,
            frontendConfig: {
                seedCandidateDeterminationStrategy: 'SameRegion',
            },
            kubeconfig,
            sessionSecret: values['gardener-dashboard'].sessionSecret,
            ingress: {
                tls: {
                    secretName: values.wildcardSecretName,
                },
                hosts: [values.gardenerHost],
            },
            oidc: {
                issuerUrl: values.issuerUrl,
                clientSecret: values.identity.dashboardClientSecret,
            },
        };
    }
}
