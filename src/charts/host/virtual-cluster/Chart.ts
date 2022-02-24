import { Chart, ChartPath, Values } from "../../../ts/utils/Helm";
import { GardenerNamespace, GeneralValues } from "../../../ts/Values";


export class VirtualClusterChart extends Chart {
    constructor() {
        super(
            'virtual-apiserver',
            new ChartPath('./src/charts/host/virtual-cluster'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            name: 'virtual-cluster',
            apiServer: {
                serviceName: 'garden-kube-apiserver',
                hostname: values.apiserver.host,
                oidcIssuerURL: values.issuerUrl,
            },
            
            tls: {
                kubeAPIServer: {
                    ca: {
                        crt: values.apiserver.tls.ca.cert,
                        key: values.apiserver.tls.ca.privateKey,
                    },
                    server: {
                        crt: values.apiserver.tls.server.cert,
                        key: values.apiserver.tls.server.privateKey,
                    },
                    basicAuthPassword: values.apiserver.admin.basicAuthPassword,
                },
                kubeAggregator: {
                    ca: {
                        crt: values.apiserver.aggregator.tls.ca.cert,
                        key: values.apiserver.aggregator.tls.ca.privateKey,
                    },
                    client: {
                        crt: values.apiserver.aggregator.tls.client.cert,
                        key: values.apiserver.aggregator.tls.client.privateKey,
                    },
                },
                kubeControllerManager: {
                    crt: values.apiserver.tls.kubeControllerManager.cert,
                    key: values.apiserver.tls.kubeControllerManager.privateKey,
                },
                serviceAccountKey: values.apiserver.admin.certificate.privateKey,
            },
            etcd: {
                main: {
                    endpoints: 'https://garden-etcd-main.garden.svc:2379',
                },
                events: {
                    endpoints: 'https://garden-etcd-events.garden.svc:2379',
                },
                secretNames: {
                    ca: 'garden-etcd-main-ca',
                    client: 'garden-etcd-main-client',
                },
            },
            networkPolicies: true,
        };
    }
}
