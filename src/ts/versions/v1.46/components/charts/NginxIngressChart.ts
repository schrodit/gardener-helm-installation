import {GeneralValues, GardenSystemNamespace} from '../../Values';
import {Chart, RemoteChart, Values} from '../../../../plugins/Helm';
import {VersionedValues} from '../../../../flow/Flow';

export type NginxIngressChartValues = VersionedValues & Pick<GeneralValues, 'ingressHost' | 'dnsController'>

export class NginxIngressChart extends Chart<NginxIngressChartValues> {
    constructor() {
        super(
            'nginx-ingress',
            new RemoteChart(
                'ingress-nginx',
                '4.0.17',
                'https://kubernetes.github.io/ingress-nginx',
            ),
            GardenSystemNamespace,
        );
    }

    public async renderValues(values: NginxIngressChartValues): Promise<Values> {
        return {
            class: 'nginx',
            controller: {
                extraArgs: {
                    'enable-ssl-passthrough': 'true',
                },
                service: {
                    annotations: {
                        'dns.gardener.cloud/class': values.dnsController.class,
                        'dns.gardener.cloud/dnsnames': `*.${values.ingressHost},${values.ingressHost}`,
                        'dns.gardener.cloud/ttl': '500',
                    },
                },
            },
        };
    }
}
