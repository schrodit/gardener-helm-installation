import { Chart, ChartPath, Values } from "../../../ts/utils/Helm";
import { GardenSystemNamespace, GeneralValues } from "../../../ts/Values";


export class DnsControllerChart extends Chart {
    constructor() {
        super(
            'dns-controller',
            new ChartPath('./src/charts/host/external-dns-management'),
            GardenSystemNamespace,
        )
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            identifier: 'gardener-default',
            createCRDs: true,
            configuration: {
                dnsClass: values.dnsController.class,
            },
            gardener: {
                seed: {
                    identity: 'gardener-host-default'
                }
            }
        };
    }
}