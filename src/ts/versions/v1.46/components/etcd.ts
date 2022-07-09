import {serviceHosts} from '../utils/kubernetes';
import {CA, createClientTLS, createSelfSignedCA, defaultExtensions, TLS} from '../utils/tls';

export interface ETCDCertificates {
    ca: CA,
    server: TLS,
    client:TLS,
}

export const generateETCDCerts = (gardenNamespace: string): ETCDCertificates => {
    const ca = createSelfSignedCA('garden:ca:etcd');

    const etcdHosts = ['localhost', 'garden-etcd-main-0', 'garden-etcd-events-0']
        .concat(serviceHosts('garden-etcd-main', gardenNamespace))
        .concat(serviceHosts('garden-etcd-events', gardenNamespace));

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
    };
};
