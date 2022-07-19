import {has} from '@0cfg/utils-common/lib/has';
import {DNS, nonRedundantDnsNames} from '../DNS';
import {GardenerNamespace, GardenSystemNamespace, GeneralValues} from '../../Values';
import {VersionedValues} from '../../../../flow/Flow';
import {Chart, ChartPath, Values} from '../../../../plugins/Helm';
import {base64EncodeMap} from '../../../../utils/kubernetes';

export type HostConfigurationChartValues = VersionedValues
    & Pick<GeneralValues,
        'apiserver'
        | 'dns'
        | 'dnsController'
        | 'acme'
        | 'ingressHost'
        | 'gardenerHost'
        | 'wildcardSecretName'>;

export class HostConfigurationChart extends Chart<HostConfigurationChartValues> {
    constructor() {
        super(
            'host-configuration',
            new ChartPath('./src/charts/host/configuration'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: HostConfigurationChartValues): Promise<Values> {
        return {
            dnsControllerClass: values.dnsController.class,
            secretName: values.wildcardSecretName,
            namespaces: [GardenerNamespace, GardenSystemNamespace],
            secretNamespaces: [GardenerNamespace, GardenSystemNamespace],
            commonDnsName: values.ingressHost,
            dnsNames: nonRedundantDnsNames([
                `*.${values.ingressHost}`,
                values.gardenerHost,
                values.apiserver.host,
                ...(has(values.dns.additionalDNSNames) ? values.dns.additionalDNSNames : []),
            ]),
            includesDnsNames: [
                values.ingressHost,
                values.gardenerHost,
                values.apiserver.host,
                ...(has(values.dns.additionalDNSNames) ? values.dns.additionalDNSNames : []),
            ],

            providerType: values.dns.provider,
            providerCredentials: base64EncodeMap(values.dns.credentials, {
                jsonIgnoreString: true,
            }),
            acme: {
                email: values.acme.email,
                dns01Solver: new DNS(values.dns).getCertBotDnsSolver(),
            },
        };
    }
}
