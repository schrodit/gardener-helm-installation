import { serviceHosts } from "./utils/kubernetes";
import { createClientTLS, createSelfSignedCA, defaultExtensions, TLS } from "./utils/tls";

export interface ETCDCertificates {
    ca: TLS,
    server: TLS,
    client:TLS,
}

export const generateETCDCerts = (gardenNamespace: string): ETCDCertificates => {
    const ca = createSelfSignedCA('garden:ca:etcd');

    const etcdHosts = ['localhost']
        .concat(serviceHosts('garden-etcd-main-0', gardenNamespace))
        .concat(serviceHosts('garden-etcd-events-0', gardenNamespace));

    const server = createClientTLS(ca, {
        cn: 'garden:etcd-server:etcd',
        altNames: etcdHosts,
        extensions: defaultExtensions(),
    });
    const client = createClientTLS(ca, {
        cn: 'garden:etcd-client:etcd',
        extensions: defaultExtensions(),
    });

    return {
        ca,
        server,
        client,
    }
}