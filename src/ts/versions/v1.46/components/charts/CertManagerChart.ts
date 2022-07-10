import {GardenSystemNamespace, GeneralValues} from '../../Values';
import {VersionedValues} from '../../../../flow/Flow';
import {Chart, RemoteChart, Values} from '../../../../plugins/Helm';

export class CertManagerChart extends Chart<VersionedValues> {
    constructor() {
        super(
            'cert-manager',
            new RemoteChart(
                'cert-manager',
                'v1.7.1',
                'https://charts.jetstack.io',
            ),
            GardenSystemNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            installCRDs: true,
        };
    }
}
