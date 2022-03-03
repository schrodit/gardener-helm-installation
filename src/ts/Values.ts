import validator from 'validator';
import {has} from './utils/has';
import {Values} from './plugins/Helm';
import {State} from './state/State';
import {generateKey, KeypairPEM} from './utils/tls';
import {ETCDCertificates, generateETCDCerts} from './etcd';
import {generateKubeAggregatorCerts, generateKubeApiserverCerts, KubeAggregatorCertificates, KubeApiserverCertificates} from './VirtualCluster';
import {deepMergeObject} from './utils/deepMerge';
import {createLogger} from './log/Logger';
import {GardenerCertificates, generateGardenerCerts} from './Gardener';

const log = createLogger('Values');

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
        accountKey?: KeypairPEM,
        admin: {
            basicAuthPassword?: string,
        }
        aggregator: {
            tls?: KubeAggregatorCertificates,
        },
    },

    gardener: {
        certs?: GardenerCertificates,
    }
}

export const emptyStateFile: StateValues = {
    identity: {},
    'gardener-dashboard': {},
    etcd: {},
    apiserver: {
        admin: {},
        aggregator: {},
    },
    gardener: {},
};

export interface InputValues {
    landscapeName: string,
    host: string,
    ingressPrefix?: string,
    gardenerDomainPrefix?: string,
    apiserverDomainPrefix?: string,

    wildcardSecretName: string,

    hostCluster: {
        network: {
            serviceCIDR: string,
            podCIDR: string,
            nodeCIDR: string,
        }
    }

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
        accountKey: KeypairPEM,
        admin: {
            basicAuthPassword: string,
        }
        aggregator: {
            tls: KubeAggregatorCertificates,
        },
    },

    gardener: {
        certs: GardenerCertificates,
        seedCandidateDeterminationStrategy: string,
        shootDomainPrefix: string,
        apiserver: {
            replicaCount?: number,
            [key: string]: any,
        },
        controller: {
            [key: string]: any,
        }
        admission: {
            replicaCount?: number,
            [key: string]: any,
        }
        scheduler: {
            [key: string]: any,
        }
    }

    etcd: {
        tls: ETCDCertificates,
    },

    [key: string]: any,
}

export interface GeneralValues extends InputValues {
    host: string,
    ingressHost: string,
    gardenerHost: string,
    issuerUrl: string,

    wildcardSecretName: string,

    apiserver: {
        host: string,
        url: string,

        tls: KubeApiserverCertificates,
        accountKey: KeypairPEM,
        admin: {
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
    const apiserverHost = addDomainPrefix(ingressHost, input.apiserverDomainPrefix);
    const apiserverUrl = `https://${apiserverHost}`;
    const issuerUrl = `https://${gardenerHost}/oidc`;

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
        log.info('etcd certs not found. Generating...');
        stateValues.etcd.tls = generateETCDCerts(GardenerNamespace);
    }

    const apiserverTls = stateValues.apiserver.tls;
    if (!has(apiserverTls) || !has(apiserverTls?.admin, apiserverTls?.kubeControllerManager, apiserverTls?.kubeControllerManager)) {
        log.info('apiserver certs not found. Generating...');
        stateValues.apiserver.tls = generateKubeApiserverCerts(GardenerNamespace, apiserverHost, gardenerHost, apiserverTls?.ca);
    }
    if (!has(stateValues.apiserver.aggregator.tls)) {
        log.info('apiserver aggregator certs not found. Generating...');
        stateValues.apiserver.aggregator.tls = generateKubeAggregatorCerts();
    }
    if (!has(stateValues.apiserver.accountKey)) {
        log.info('apiserver admin cert not found. Generating...');
        stateValues.apiserver.accountKey = generateKey();
    }
    stateValues.apiserver.admin.basicAuthPassword = generateRandomIfNotDefined(
        undefined,
        stateValues.apiserver.admin.basicAuthPassword,
        30,
    );

    const gardenerCerts = stateValues.gardener.certs;
    if (!has(gardenerCerts) || !has(gardenerCerts?.apiserver, gardenerCerts?.controllerManager, gardenerCerts?.admissionController)) {
        log.info('gardener certs not found. Generating...');
        stateValues.gardener.certs = generateGardenerCerts(GardenerNamespace, gardenerCerts?.ca);
    }

    input = deepMergeObject(input, stateValues);

    await state.store(stateValues);
    log.info('Succesfully stored state');
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
            class: 'garden-host',
        },
    }, input);

    return general;
};

const validateInput = (input: InputValues): void => {
    required(input, 'host');
    if (!validator.isURL(input.host,  {require_protocol: false})) {
        throw new Error(`Invalid host ${input.host}`);
    }

    required(input, 'acme', 'email');
    required(input, 'dns', 'provider');
    required(input, 'dns', 'credentials');
    required(input, 'hostCluster', 'network', 'nodeCIDR');
    required(input, 'hostCluster', 'network', 'podCIDR');
    required(input, 'hostCluster', 'network', 'serviceCIDR');
};

const validateStateAndInputValues = (input: InputValues): void => {
    required(input, 'identity', 'dashboardClientSecret');
    required(input, 'identity', 'kubectlClientSecret');
    required(input, 'gardener-dashboard', 'sessionSecret');
};

const generateRandomIfNotDefined = (value: string | undefined, state: string | undefined, length: number): string => {
    if (has(value)) {
        return value as string;
    }
    if (has(state)) {
        return state as string;
    }
    return randomString(length);
};

const required = (values: Values, ...path: string[]) => {
    let lastObj = values;
    let objPath = '';
    for (const p of path) {
        objPath += `.${p}`;
        if (!has(lastObj[p])) {
            throw new Error(`${objPath} is required`);
        }
        lastObj = lastObj[p];
    }
};

/**
 * Adds the prefix as subdomain to the domain
 */
const addDomainPrefix = (domain: string, prefix?: string): string => {
    if (!has(prefix)) {
        return domain;
    }
    return `${prefix}.${domain}`;
};

const randomString = (length: number): string => {
    let result           = '';
    const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
};
