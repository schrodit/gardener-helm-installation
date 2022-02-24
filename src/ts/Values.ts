import { has } from "./utils/has";
import { merge } from '@0cfg/utils-common/lib/merge';
import validator from 'validator';
import { Values } from "./utils/Helm";
import { State } from "./state/State";
import { generateKey, Keypair, KeypairPEM, TLS } from "./utils/tls";
import { ETCDCertificates, generateETCDCerts } from "./etcd";
import { generateKubeAggregaotrCerts, generateKubeApiserverCerts, KubeAggregatorCertificates, KubeApiserverCertificates } from "./virtualCluster";
import { deepMergeObject } from "./utils/deepMerge";

export const GardenerNamespace = 'garden';
export const GardenSystemNamespace = 'garden-system';
export const KubeSystemNamespace = 'kube-system';
export const DefaultNamespace = 'default';

export interface StateValues {
    identity: {
        dashboardClientSecret?: string,
        kubectlClientSecret?: string,
    },

    'gardener-dashboard': {
        sessionSecret?: string,
    },

    etcd: {
        tls?: ETCDCertificates,
    },

    apiserver: {
        tls?: KubeApiserverCertificates,
        admin: {
            certificate?: KeypairPEM,
            basicAuthPassword?: string,
        }
        aggregator: {
            tls?: KubeAggregatorCertificates,
        },
    },
}

export const emptyStateFile: StateValues = {
    identity: {},
    'gardener-dashboard': {},
    etcd: {},
    apiserver: {
        admin: {},
        aggregator: {},
    },
}

export interface InputValues {
    host: string,
    ingressPrefix?: string,
    gardenerDomainPrefix?: string,
    apiserverDomainPrefix?: string,

    wildcardSecretName: string,

    identity: {
        dashboardClientSecret: string,
        kubectlClientSecret: string,
        [key: string]: any,
    }

    'gardener-dashboard': {
        sessionSecret: string,
        [key: string]: any,
    }

    dns: {
        provider: string,
        credentials: Record<string, any>
    }

    acme: {
        email: string,
    }

    apiserver: {
        tls: KubeApiserverCertificates,
        admin: {
            certificate: KeypairPEM,
            basicAuthPassword: string,
        }
        aggregator: {
            tls: KubeAggregatorCertificates,
        },
    },

    etcd: {
        tls: ETCDCertificates,
    },

    [key: string]: any,
};

export interface GeneralValues extends InputValues {
    host: string,
    ingressHost: string,
    gardenerHost: string,
    issuerUrl: string,

    apiserver: {
        host: string,
        url: string,

        tls: KubeApiserverCertificates,
        admin: {
            certificate: KeypairPEM,
            basicAuthPassword: string,
        }
        aggregator: {
            tls: KubeAggregatorCertificates,
        },
    }

    dnsController: {
        class: string,
    }

    [key: string]: any,
}

export const generateGardenerInstallationValues = async (state: State<StateValues>, input: InputValues): Promise<GeneralValues> => {
    validateInput(input);

    const ingressHost = addDomainPrefix(input.host, input.ingressPrefix);
    const gardenerHost = addDomainPrefix(ingressHost, input.gardenerDomainPrefix);
    const apiserverHost = addDomainPrefix(ingressHost, input.apiserverDomainPrefix ?? 'api');
    const apiserverUrl = `https://${apiserverHost}`;
    const issuerUrl = `https://${gardenerHost}/oidc`;
    const wildcardSecretName = input.wildcardSecretName ?? 'gardener-wildcard-tls';

    const stateValues = await state.get();

    // generate random values if not defined
    stateValues.identity.dashboardClientSecret = generateRandomIfNotDefined(
        input.identity.dashboardClientSecret,
        stateValues.identity.dashboardClientSecret,
        30,
    );
    stateValues.identity.kubectlClientSecret = generateRandomIfNotDefined(
        input.identity.kubectlClientSecret,
        stateValues.identity.kubectlClientSecret,
        30,
    );
    stateValues['gardener-dashboard'].sessionSecret = generateRandomIfNotDefined(
        input['gardener-dashboard'].sessionSecret,
        stateValues['gardener-dashboard'].sessionSecret,
        30,
    );
    
    if (!has(stateValues.etcd.tls)) {
        stateValues.etcd.tls = generateETCDCerts(GardenerNamespace);
    }

    if (!has(stateValues.apiserver.tls)) {
        stateValues.apiserver.tls = generateKubeApiserverCerts(GardenerNamespace, apiserverHost, gardenerHost);
    }
    if (!has(stateValues.apiserver.aggregator.tls)) {
        stateValues.apiserver.aggregator.tls = generateKubeAggregaotrCerts();
    }
    if (!has(stateValues.apiserver.admin.certificate)) {
        stateValues.apiserver.admin.certificate = generateKey();
    }
    stateValues.apiserver.admin.basicAuthPassword = generateRandomIfNotDefined(
        undefined,
        stateValues.apiserver.admin.basicAuthPassword,
        30,
    );

    input = deepMergeObject(input, stateValues);

    await state.store(stateValues);
    validateStateAndInputValues(input);

    const general: GeneralValues = deepMergeObject({
        host: input.host,
        ingressHost,
        gardenerHost,
        issuerUrl,
        apiserver: {
            host: apiserverHost,
            url: apiserverUrl,
        },
        dnsController: {
            class: 'garden-host'
        },
        wildcardSecretName,
    }, input);

    return general;
}

const validateInput = (input: InputValues): void => {
    required(input, 'host');
    if (!validator.isURL(input.host,  {require_protocol: false})) {
        throw new Error(`Invalid host ${input.host}`);
    }

    required(input, 'acme', 'email');
    required(input, 'dns', 'provider');
    required(input, 'dns', 'credentials');
}

const validateStateAndInputValues = (input: InputValues): void => {
    required(input, 'identity', 'dashboardClientSecret');
    required(input, 'identity', 'kubectlClientSecret');
    required(input, 'gardener-dashboard', 'sessionSecret');
}

const generateRandomIfNotDefined = (value: string | undefined, state: string | undefined, length: number): string => {
    if (has(value)) {
        return value as string;
    }
    if (has(state)) {
        return state as string;
    }
    return randomString(length);
}

const required = (values: Values, ...path: string[]) => {
    let lastObj = values;
    let objPath = '';
    for(const p of path) {
        objPath += `.${p}`;
        if(!has(lastObj[p])) {
            throw new Error(`${objPath} is required`)
        }
        lastObj = lastObj[p];
    }
}

/**
 * Adds the prefix as subdomain to the domain
 */
const addDomainPrefix = (domain: string, prefix?: string): string => {
    if (!has(prefix)) {
        return domain;
    }
    return `${prefix}.${domain}`;
}

const randomString = (length: number): string => {
    let result           = '';
    const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}