import {Chart, ChartPath, Values} from '../../../ts/plugins/Helm';
import {GardenerNamespace, GeneralValues} from '../../../ts/Values';

export class EtcdMainChart extends Chart {
    constructor() {
        super(
            'etcd-main',
            new ChartPath('./src/charts/host/etcd'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            name: 'garden-etcd-main',
            tls: {
                ca: {
                    crt: values.etcd.tls.ca.cert,
                    key: values.etcd.tls.ca.privateKey,
                },
                server: {
                    crt: values.etcd.tls.server.cert,
                    key: values.etcd.tls.server.privateKey,
                },
                client: {
                    crt: values.etcd.tls.client.cert,
                    key: values.etcd.tls.client.privateKey,
                },
            },
        };
    }
}

export class EtcdEventsChart extends Chart {
    constructor() {
        super(
            'etcd-events',
            new ChartPath('./src/charts/host/etcd'),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            name: 'garden-etcd-events',
            tls: {
                ca: {
                    crt: values.etcd.tls.ca.cert,
                    key: values.etcd.tls.ca.privateKey,
                },
                server: {
                    crt: values.etcd.tls.server.cert,
                    key: values.etcd.tls.server.privateKey,
                },
                client: {
                    crt: values.etcd.tls.client.cert,
                    key: values.etcd.tls.client.privateKey,
                },
            },
        };
    }
}
