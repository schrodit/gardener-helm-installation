import {GardenerNamespace, GeneralValues} from '../../Values';
import {waitUntilVirtualClusterIsReady} from '../VirtualCluster';
import {VersionedValues} from '../../../../flow/Flow';
import {Chart, RemoteChartFromZip, Values} from '../../../../plugins/Helm';
import {trimPrefix} from '../../../../utils/trimPrefix';
import {createLogger} from '../../../../log/Logger';

const log = createLogger('GardenerDashboard');

const version = '1.70.1';

const repoZipUrl = (version: string) =>
    `https://github.com/gardener/dashboard/archive/refs/tags/${version}.zip`;
export const chartsBasePath = (version: string, chart:string) =>
    `dashboard-${trimPrefix(version, 'v')}/charts/${chart}`;

export type GardenerDashboardChartValues = VersionedValues
    & Pick<GeneralValues,
        'identity'
        | 'apiserver'
        | 'gardener-dashboard'
        | 'issuerUrl'
        | 'gardenerHost'
        | 'wildcardSecretName'>;

export class GardenerDashboardChart extends Chart<GardenerDashboardChartValues> {
    constructor(private readonly dryRun: boolean) {
        super(
            'gardener-dashboard',
            new RemoteChartFromZip(
                repoZipUrl(version),
                chartsBasePath(version, 'gardener-dashboard')),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GardenerDashboardChartValues): Promise<Values> {
        let kubeconfig = 'dummy';
        if (!this.dryRun) {
            kubeconfig = (await waitUntilVirtualClusterIsReady(log, values)).getKubeConfig().exportConfig();
        }
        return {
            global: {
                dashboard: {
                    image: {
                        tag: version,
                    },
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
                        clientId: 'dashboard',
                        issuerUrl: values.issuerUrl,
                        clientSecret: values.identity.dashboardClientSecret,
                    },
                },
            },
        };
    }
}
