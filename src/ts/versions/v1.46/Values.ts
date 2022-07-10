import validator from 'validator';
import {generateKey, KeypairPEM} from '../../utils/tls';
import {Values} from '../../plugins/Helm';
import {deepMergeObject} from '../../utils/deepMerge';
import {has} from '../../utils/has';
import {createLogger} from '../../log/Logger';
import {randomString} from '../../utils/randomString';
import {VersionedValues} from '../../flow/Flow';
import {VersionedState} from '../../Landscape';
import {ETCDCertificates, generateETCDCerts} from './components/etcd';
import {generateKubeAggregatorCerts, generateKubeApiserverCerts, KubeAggregatorCertificates, KubeApiserverCertificates} from './components/VirtualCluster';
import {GardenerCertificates, generateGardenerCerts} from './components/gardener/Gardener';
import {DNSValues} from './components/DNS';
import {GardenerExtension} from './components/GardenerExtensions';
import {GardenerInitConfig} from './components/GardenerInitConfig';
import {Backup, GardenBackup} from './components/Backup';

const log = createLogger('Values');

export const GardenerNamespace = 'garden';
export const GardenSystemNamespace = 'garden-system';
export const KubeSystemNamespace = 'kube-system';
export const DefaultNamespace = 'default';

export interface StateValues extends VersionedValues {
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

export const emptyState = (version: string): StateValues => {
    return {
        version,
        identity: {},
        'gardener-dashboard': {},
        etcd: {},
        apiserver: {
            admin: {},
            aggregator: {},
        },
        gardener: {},
    };
};

export interface InputValues extends VersionedValues {
    landscapeName: string,
    host: string,
    ingressPrefix?: string,
    gardenerDomainPrefix?: string,
    apiserverDomainPrefix?: string,

    wildcardSecretName: string,

    hostCluster: {
        provider: string,
        region: string,
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

    dns: DNSValues,

    acme: {
        email: string,
    }

    backup?: GardenBackup,

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
        autoPatchUpdate?: boolean,
        certs: GardenerCertificates,
        seedCandidateDeterminationStrategy: string,
        shootDomainPrefix: string,

        featureGates?: Record<string, boolean>,

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
        },

        soil: {
            shootDefaultNetworks: {
                pods: string,
                services: string,
            },
            blockCIDRs: string[],
            backup?: Backup,
            settings: Values,
        },

        initConfig: GardenerInitConfig,

        extensions: Record<string, GardenerExtension>,
    }

    etcd: {
        tls: ETCDCertificates,
    },

    [key: string]: any,
}

export interface GeneralValues extends VersionedValues, InputValues {
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

export const generateGardenerInstallationValues = async (stateValues: VersionedState, input: Values): Promise<GeneralValues> => {
    if (!isInputValues(input)) {
        throw validateInput(input);
    }
    if (!isStateValues(stateValues)) {
        throw validateState(stateValues);
    }

    const ingressHost = addDomainPrefix(input.host, input.ingressPrefix);
    const gardenerHost = addDomainPrefix(ingressHost, input.gardenerDomainPrefix);
    const apiserverHost = addDomainPrefix(ingressHost, input.apiserverDomainPrefix);
    const apiserverUrl = `https://${apiserverHost}`;
    const issuerUrl = `https://${gardenerHost}/oidc`;

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
    let updatedApiServerTls = false;
    if (!has(apiserverTls) || !has(apiserverTls?.admin, apiserverTls?.kubeControllerManager, apiserverTls?.kubeControllerManager)) {
        log.info('apiserver certs not found. Generating...');
        updatedApiServerTls = true;
        stateValues.apiserver.tls = generateKubeApiserverCerts(GardenerNamespace, apiserverHost, gardenerHost, apiserverTls?.ca);
    }
    if (updatedApiServerTls || !has(stateValues.apiserver.aggregator.tls)) {
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

    input = deepMergeObject(stateValues, input);
    if (!isInputValues(input)) {
        throw validateInput(input);
    }

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

const isInputValues = (input: Values): input is InputValues => {
    return validateInput(input) === null;
};

const validateInput = (input: Values): null | Error => {
    try {
        required(input, 'version');
        if (!input.version.startsWith('v')) {
            throw new Error(`Version is expected to be of the form "vMaj.Min.Patch" but is ${input.version}`);
        }
        required(input, 'host');
        if (!validator.isURL(input.host,  {require_protocol: false})) {
            throw new Error(`Invalid host ${input.host}`);
        }

        required(input, 'acme', 'email');
        required(input, 'dns', 'provider');
        required(input, 'dns', 'credentials');
        required(input, 'hostCluster', 'provider');
        required(input, 'hostCluster', 'region');
        required(input, 'hostCluster', 'network', 'nodeCIDR');
        required(input, 'hostCluster', 'network', 'podCIDR');
        required(input, 'hostCluster', 'network', 'serviceCIDR');
        return null;
    } catch (e) {
        if (e instanceof Error) {
            return e;
        }
        throw e;
    }
};

export const isStateValues = (input: Values): input is StateValues => {
    return validateState(input) === null;
};

const validateState = (input: Values): null | Error => {
    try {
        required(input, 'etcd');
        required(input, 'apiserver');
        required(input, 'gardener');
        return null;
    } catch (e) {
        if (e instanceof Error) {
            return e;
        }
        throw e;
    }
};

const validateStateAndInputValues = (input: Values): input is InputValues => {
    required(input, 'identity', 'dashboardClientSecret');
    required(input, 'identity', 'kubectlClientSecret');
    required(input, 'gardener-dashboard', 'sessionSecret');
    return true;
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

export const required = (values: Values, ...path: string[]) => {
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
