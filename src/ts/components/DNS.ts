import {Values} from '../plugins/Helm';
import {has} from '../utils/has';

export interface DNSValues {
    provider: string,
    credentials: Record<string, any>
}

type DnsMappingFunc = (values: DNSValues) => Values;

/**
 * Maps the dns controller dns provider to the cert-bot dns01 challenge
 */
 const dnsProviderMapping: Record<string, DnsMappingFunc> = {
    'cloudflare-dns': (_: DNSValues): Values => {
        return {
            cloudflare: {
                apiTokenSecretRef: {
                    name: 'gardener-default',
                    key: 'apiToken',
                },
            },
        };
    },
};

/**
 * DNS utils class
 */
export class DNS {

    private readonly provider: string;
    private readonly credentials: Record<string, any>;

    constructor(private values: DNSValues) {
        this.provider = values.provider;
        this.credentials = values.credentials;

        if (!has(dnsProviderMapping[values.provider])) {
            throw new Error(`Unsupported DNS provider ${values.provider}. Supported Values ${Object.keys(dnsProviderMapping).join(',')}`);
        }
    }

    public getCertBotDnsSolver(): Values {
        return dnsProviderMapping[this.provider](this.values);
    }

}
