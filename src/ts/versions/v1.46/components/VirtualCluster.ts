import {Agent} from 'https';
import axios from 'axios';
import {KubeConfig} from '@kubernetes/client-node';
import {GeneralValues} from '../Values';
import {CA, createClientTLS, createSelfSignedCA, defaultExtensions, TLS} from '../../../utils/tls';
import {serviceHosts} from '../../../utils/kubernetes';
import {base64Encode} from '../../../utils/base64Encode';
import {retryWithBackoff} from '../../../utils/exponentialBackoffRetry';
import {DefaultKubeClient} from '../../../utils/DefaultKubeClient';
import {Logger} from '../../../log/Logger';
import {KubeClient} from '../../../utils/KubeClient';

export interface KubeApiserverCertificates {
    ca: CA,
    server: TLS,
    kubeControllerManager: TLS,
    admin: TLS,
}

export type ApiServerValues = Pick<GeneralValues, 'apiserver'>;

export const generateKubeApiserverCerts = (
    gardenNamespace: string,
    apiserverHost: string,
    gardenerHost: string,
    ca: CA = createSelfSignedCA('garden:ca:kube-apiserver'),
): KubeApiserverCertificates => {

    const apiserverHosts = ['localhost', '127.0.0.1', apiserverHost, gardenerHost]
        .concat(serviceHosts('garden-kube-apiserver', gardenNamespace))
        .concat(serviceHosts('kubernetes', 'default'));

    const server = createClientTLS(ca, {
        cn: 'garden:server:kube-apiserver',
        altNames: apiserverHosts,
        extensions: defaultExtensions(),
    });
    const kubeControllerManager = createClientTLS(ca, {
        cn: 'system:kube-controller-manager',
        extensions: defaultExtensions(),
    });
    const admin = createClientTLS(ca, {
        cn: 'garden:client:admin',
        organization: 'system:masters',
        extensions: defaultExtensions(),
    });

    return {
        ca,
        server,
        kubeControllerManager,
        admin,
    };
};

export interface KubeAggregatorCertificates {
    ca: TLS,
    client: TLS,
}

export const generateKubeAggregatorCerts = (): KubeAggregatorCertificates => {
    const ca = createSelfSignedCA('garden:ca:kube-aggregator');

    const client = createClientTLS(ca, {
        cn: 'garden:aggregator-client:kube-aggregator',
        extensions: defaultExtensions(),
    });

    return {
        ca,
        client,
    };
};

export const getVirtualClusterAdminKubeconfig = (values: ApiServerValues): KubeConfig => {
    const contextName = 'garden';
    const clusterName = 'virtual-cluster';
    const userName = 'admin';

    const kc = new KubeConfig();
    kc.addCluster({
        name: clusterName,
        server: values.apiserver.url,
        caData: base64Encode(values.apiserver.tls.ca.cert),
        skipTLSVerify: false,
    });
    kc.addUser({
        name: userName,
        certData: base64Encode(values.apiserver.tls.admin.cert),
        keyData: base64Encode(values.apiserver.tls.admin.privateKey),
    });
    kc.addContext({
        name: contextName,
        cluster: clusterName,
        user: userName,
    });
    kc.setCurrentContext(contextName);
    return kc;
};

/**
 * Waits until the virtual cluster is ready and returns the KubeClient.
 */
export const waitUntilVirtualClusterIsReady = async (log: Logger, values: ApiServerValues): Promise<KubeClient> => {
    const instance = axios.create({
        httpsAgent: new Agent({
            ca: values.apiserver.tls.ca.cert,
            cert: values.apiserver.tls.admin.cert,
            key: values.apiserver.tls.admin.privateKey,
        }),
    });
    await retryWithBackoff(async (): Promise<boolean> => {
        try {
            const req = await instance.get(values.apiserver.url);
            if (req.status === 200) {
                return true;
            }
        } catch (error) {
            log.error(`Virtual cluster not ready yet ${error}`);
        }
        return false;
    });
    log.info('Virtual cluster ready');

    return new DefaultKubeClient(getVirtualClusterAdminKubeconfig(values));
};
