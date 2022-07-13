import {GardenerNamespace, GeneralValues} from '../../Values';
import {VersionedValues} from '../../../../flow/Flow';
import {Chart, ChartPath, Values} from '../../../../plugins/Helm';

export type IdentityChartValues = VersionedValues
    & Pick<GeneralValues, 'identity' | 'gardenerHost' | 'issuerUrl' | 'wildcardSecretName'>

export class IdentityChart extends Chart<IdentityChartValues> {
    constructor() {
        super(
            'identity',
            new ChartPath('./src/charts/host/identity'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: IdentityChartValues): Promise<Values> {
        return {
            ...values.identity,
            replicaCount: values.identity.replicas,
            dashboardClientSecret: values.identity.dashboardClientSecret,
            kubectlClientSecret: values.identity.kubectlClientSecret,
            dashboardOrigins: [
                `https://${values.gardenerHost}`,
                `https://${values.gardenerHost}/oidc`,
            ],
            issuerUrl: values.issuerUrl,
            tlsSecretName: values.wildcardSecretName,
        };
    }
}
