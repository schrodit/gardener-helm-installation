import {Chart, RemoteChartFromZip, Values} from '../../plugins/Helm';
import {GardenerNamespace, GeneralValues} from '../../Values';
import {waitUntilVirtualClusterIsReady} from '../VirtualCluster';
import {createLogger} from '../../log/Logger';
import {trimPrefix} from '../../utils/trimPrefix';

const log = createLogger('GardenerDashboard');

const version = '1.55.1';

const repoZipUrl = (version: string) =>
    `https://github.com/gardener/dashboard/archive/refs/tags/${version}.zip`;
export const chartsBasePath = (version: string, chart:string) =>
    `dashboard-${trimPrefix(version, 'v')}/charts/${chart}`;

export class GardenerDashboardChart extends Chart {
    constructor(private readonly dryRun: boolean) {
        super(
            'gardener-dashboard',
            new RemoteChartFromZip(
                repoZipUrl(version),
                chartsBasePath(version, 'gardener-dashboard')),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        let kubeconfig = 'dummy';
        if (!this.dryRun) {
            kubeconfig = (await waitUntilVirtualClusterIsReady(log, values)).getKubeConfig().exportConfig();
        }
        return {
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
                issuerUrl: values.issuerUrl,
                clientSecret: values.identity.dashboardClientSecret,
            },
        };
    }
}
