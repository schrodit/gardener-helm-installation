import {Chart, ChartPath, Values} from '../../plugins/Helm';
import {GardenerNamespace, GeneralValues, required} from '../../Values';
import {base64EncodeMap} from '../../utils/kubernetes';

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
            backup: this.backupConfig(values),
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

    private backupConfig(values: GeneralValues) {
        if (!values.backup) {
            return;
        }
        required(values, 'backup', 'storageContainer');
        switch (values.backup.provider) {
            case 'gcp':
                required(values.backup, 'credentials', 'serviceaccount.json');
                return {
                    storageProvider: 'GCS',
                    storageContainer: values.backup.storageContainer,
                    secretData: base64EncodeMap(values.backup.credentials, {jsonIgnoreString: true}),
                    env: [{
                        name: 'GOOGLE_APPLICATION_CREDENTIALS',
                        value: '/root/.gcp/serviceaccount.json',
                    }],
                    volumeMounts: [{
                        name: 'etcd-backup',
                        mountPath: '/root/.gcp/',
                    }],
                };
            default:
                throw new Error(`Unsupported storage provider ${values.backup.providerConfig}`);
        }
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
