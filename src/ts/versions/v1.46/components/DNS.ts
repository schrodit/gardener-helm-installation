import {has} from '@0cfg/utils-common/lib/has';
import {Values} from '../../../plugins/Helm';
import {trimPrefix} from '../../../utils/trimPrefix';

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

export const nonRedundantDnsNames = (dnsNames: string[]): string[] => {
    const wildcardDomains = dnsNames
        .filter( n => n.startsWith('*'));
    const wildcardDomainsSet = new Set(wildcardDomains
        .map(n => trimPrefix(n, '*.')));
    const isCoveredByWildcardDomain = (domain: string): boolean => {
        return wildcardDomainsSet.has(domain.split('.').splice(1).join('.'));
    };
    return dnsNames.filter(n => !isCoveredByWildcardDomain(n)).concat(wildcardDomains);
};
