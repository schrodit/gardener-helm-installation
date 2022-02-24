import { serviceHosts } from "./utils/kubernetes";
import { createClientTLS, createSelfSignedCA, defaultExtensions, TLS } from "./utils/tls";

export interface KubeApiserverCertificates {
    ca: TLS,
    server: TLS,
    kubeControllerManager:TLS,
}

export const generateKubeApiserverCerts = (gardenNamespace: string, apiserverHost: string, gardenerHost: string): KubeApiserverCertificates => {
    const ca = createSelfSignedCA('garden:ca:kube-apiserver');

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

    return {
        ca,
        server,
        kubeControllerManager,
    }
};

export interface KubeAggregatorCertificates {
    ca: TLS,
    client: TLS,
}

export const generateKubeAggregaotrCerts = (): KubeAggregatorCertificates => {
    const ca = createSelfSignedCA('garden:ca:kube-aggregator');

    const client = createClientTLS(ca, {
        cn: 'garden:aggregator-client:kube-aggregator',
        extensions: defaultExtensions(),
    });

    return {
        ca,
        client,
    }
};
