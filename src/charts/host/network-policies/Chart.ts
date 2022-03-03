import {Chart, ChartPath, Values} from '../../../ts/plugins/Helm';
import {GardenerNamespace, GeneralValues} from '../../../ts/Values';

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
