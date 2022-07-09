import {Chart, ChartPath, Values} from '../../plugins/Helm';
import {GardenerNamespace, GeneralValues} from '../../Values';

export class IdentityChart extends Chart {
    constructor() {
        super(
            'identity',
            new ChartPath('./src/charts/host/identity'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            dashboardClientSecret: '',
            kubectlClientSecret: '',
            dashboardOrigins: [
                `https://${values.gardenerHost}`,
                `https://${values.gardenerHost}/oidc`,
            ],
            issuerUrl: values.issuerUrl,
            tlsSecretName: values.wildcardSecretName,
            connectors: '',
            staticPasswords: '',
        };
    }
}
