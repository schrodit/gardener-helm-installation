import {GardenerNamespace} from '../../Values';
import {VersionedValues} from '../../../../flow/Flow';
import {Chart, ChartPath, Values} from '../../../../plugins/Helm';

export class NetworkPoliciesChart extends Chart<VersionedValues> {
    constructor() {
        super(
            'gardener-network-policies',
            new ChartPath('./src/charts/host/network-policies'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: VersionedValues): Promise<Values> {
        return {};
    }
}
