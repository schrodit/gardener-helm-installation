import {DNS, nonRedundantDnsNames} from '../DNS';
import {Chart, ChartPath, Values} from '../../plugins/Helm';
import {base64EncodeMap} from '../../utils/kubernetes';
import {GardenerNamespace, GardenSystemNamespace, GeneralValues} from '../../Values';

export class HostConfigurationChart extends Chart {
    constructor() {
        super(
            'host-configuration',
            new ChartPath('./src/charts/host/configuration'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
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
            ]),
            includesDnsNames: [
                values.ingressHost,
                values.gardenerHost,
                values.apiserver.host,
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
