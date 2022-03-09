import {Chart, ChartPath, Values} from '../../plugins/Helm';
import {GardenerNamespace, GeneralValues} from '../../Values';

export class NetworkPoliciesChart extends Chart {
    constructor() {
        super(
            'gardener-network-policies',
            new ChartPath('./src/charts/host/network-policies'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {};
    }
}
