import {Chart, ChartPath, Values} from '../../plugins/Helm';
import {GardenSystemNamespace, GeneralValues} from '../../Values';

export class DnsControllerChart extends Chart {
    constructor() {
        super(
            'dns-controller',
            new ChartPath('./src/charts/host/external-dns-management'),
            GardenSystemNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            identifier: 'gardener-default',
            fullnameOverride: 'host-dns-controller-manager',
            createCRDs: true,
            configuration: {
                dnsClass: values.dnsController.class,
            },
            gardener: {
                seed: {
                    identity: 'gardener-host-default',
                },
            },
        };
    }
}
