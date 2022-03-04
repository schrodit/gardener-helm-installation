import {DNS, nonRedundantDnsNames} from '../../../ts/components/DNS';
import {Chart, ChartPath, Values} from '../../../ts/plugins/Helm';
import {base64EncodeMap} from '../../../ts/utils/kubernetes';
import {GardenerNamespace, GardenSystemNamespace, GeneralValues} from '../../../ts/Values';

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
