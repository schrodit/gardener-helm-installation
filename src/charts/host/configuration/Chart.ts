import { has } from "@0cfg/utils-common/lib/has";
import { hasSubscribers } from "diagnostics_channel";
import { Chart, ChartPath, Values } from "../../../ts/plugins/Helm";
import { base64EncodeMap } from "../../../ts/utils/kubernetes";
import { GardenerNamespace, GardenSystemNamespace, GeneralValues, KubeSystemNamespace } from "../../../ts/Values";

type DnsMappingFunc = (values: GeneralValues) => Values;

/**
 * Maps the dns controller dns provider to the cert-bot dns01 challenge
 */
const dnsProviderMapping: Record<string, DnsMappingFunc> = {
    'cloudflare-dns': (_: GeneralValues): Values => {
        return {
            cloudflare: {
                apiTokenSecretRef: {
                    name: 'gardener-default',
                    key: 'apiToken',
                },
            }
        }
    }
}


export class HostConfigurationChart extends Chart {
    constructor() {
        super(
            'host-configuration',
            new ChartPath('./src/charts/host/configuration'),
            GardenerNamespace,
        )
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        const providerMapping = dnsProviderMapping[values.dns.provider];

        if (!has(providerMapping)) {
            throw new Error(`DNS provider ${values.dns.provider} is currently supported. Supported Values ${Object.keys(dnsProviderMapping).join(',')}`);
        }

        return {
            dnsControllerClass: values.dnsController.class,
            secretName: values.wildcardSecretName,
            namespaces: [GardenerNamespace, GardenSystemNamespace],
            secretNamespaces: [GardenerNamespace, GardenSystemNamespace],
            commonDnsName: values.ingressHost,
            dnsNames: [
                `*.${values.ingressHost}`,
                values.gardenerHost,
                values.apiserver.host,
            ],
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
                dns01Solver: providerMapping(values),
            },
        };
    }
}