import {Chart, ChartPath, Values} from '../../../ts/plugins/Helm';
import {GardenerNamespace, GeneralValues} from '../../../ts/Values';

export class GardenerDashboardChart extends Chart {
    constructor() {
        super(
            'gardener-dashboard',
            new ChartPath('./src/charts/host/gardener-dashboard'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            apiServerUrl: values.apiserver.url,
            apiServerCa: values.apiserver.tls.ca.cert,
            frontendConfig: {
                seedCandidateDeterminationStrategy: 'SameRegion',
            },
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
