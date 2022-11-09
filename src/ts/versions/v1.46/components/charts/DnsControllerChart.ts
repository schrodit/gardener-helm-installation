import {GardenSystemNamespace, GeneralValues} from '../../Values';
import {VersionedValues} from '../../../../flow/Flow';
import {Chart, ChartPath, Values} from '../../../../plugins/Helm';

export type DnsControllerChartValues = VersionedValues & Pick<GeneralValues, 'dnsController'>;

export class DnsControllerChart extends Chart<DnsControllerChartValues> {
    constructor() {
        super(
            'dns-controller',
            new ChartPath('./src/charts/host/external-dns-management'),
            GardenSystemNamespace,
        );
    }

    public async renderValues(values: DnsControllerChartValues): Promise<Values> {
        return {
            identifier: 'gardener-default',
            fullnameOverride: 'host-dns-controller-manager',
            createCRDs: true,
            configuration: {
                dnsClass: values.dnsController.class,
                disableNamespaceRestriction: true,
            },
            gardener: {
                seed: {
                    identity: 'gardener-host-default',
                },
            },
        };
    }
}
