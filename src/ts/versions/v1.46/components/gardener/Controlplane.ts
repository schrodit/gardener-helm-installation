import path from 'path';
import {SemVer} from 'semver';
import IPCIDR from 'ip-cidr';
import {GardenerNamespace, GardenSystemNamespace, GeneralValues} from '../../Values';
import {ApiServerValues, waitUntilVirtualClusterIsReady} from '../VirtualCluster';
import {Task, VersionedValues} from '../../../../flow/Flow';
import {createLogger} from '../../../../log/Logger';
import {KubeClient} from '../../../../utils/KubeClient';
import {Chart, Helm, RemoteChartFromZip, Values} from '../../../../plugins/Helm';
import {deepMergeObject} from '../../../../utils/deepMerge';
import {base64EncodeMap, getKubeConfigForServiceAccount} from '../../../../utils/kubernetes';
import {GardenerChartBasePath, GardenerRepoZipUrl} from './Gardener';

const log = createLogger('Gardener');

const defaultResources = {
    'apiserver': {
        'limits': {
            'cpu': '300m',
            'memory': '256Mi',
        },
        'requests': {
            'cpu': '100m',
            'memory': '100Mi',
        },
    },
    'admission': {
        'requests': {
            'cpu': '100m',
            'memory': '200Mi',
        },
        'limits': {
            'cpu': '300m',
            'memory': '512Mi',
        },
    },
    'controller': {
        'limits': {
            'cpu': '750m',
            'memory': '512Mi',
        },
        'requests': {
            'cpu': '100m',
            'memory': '100Mi',
        },
    },
    'scheduler': {
        'limits': {
            'cpu': '300m',
            'memory': '256Mi',
        },
        'requests': {
            'cpu': '50m',
            'memory': '50Mi',
        },
    },
};

export type ControlplaneValues = VersionedValues & ApiServerValues
    & Pick<GeneralValues, 'gardener' | 'host' | 'hostCluster' | 'landscapeName' | 'etcd' | 'dns'>;

export class Controlplane extends Task {

    private virtualClient?: KubeClient;

    constructor(
        private readonly version: SemVer,
        private readonly hostClient: KubeClient,
        private readonly helm: Helm,
        private readonly values: ControlplaneValues,
        private readonly dryRun: boolean,
    ) {
        super('Controlplane');
    }

    public async do(): Promise<void> {
        log.info(`Installing Gardener version ${this.version.raw}`);
        if (!this.dryRun) {
            this.virtualClient = await waitUntilVirtualClusterIsReady(log, this.values);
        }

        log.info('Install Gardener Controlplane');

        const gardenerValues = this.getValues();

        const applicationHelmChart = new ApplicationChart(this.version.raw, gardenerValues);
        await this.helm.createOrUpdate(await applicationHelmChart.getRelease(this.values), this.virtualClient?.getKubeConfig());

        gardenerValues.global.apiserver.kubeconfig = await this.getKubeConfigForServiceAccount('gardener-apiserver');
        gardenerValues.global.controller.kubeconfig = await this.getKubeConfigForServiceAccount('gardener-controller-manager');
        gardenerValues.global.scheduler.kubeconfig = await this.getKubeConfigForServiceAccount('gardener-scheduler');
        gardenerValues.global.admission.kubeconfig = await this.getKubeConfigForServiceAccount('gardener-admission-controller');

        const runtimeHelmChart = new RuntimeChart(this.version.raw, gardenerValues);
        await this.helm.createOrUpdate(await runtimeHelmChart.getRelease(this.values));
    }

    private getValues() {
        return {
            global: {
                apiserver: this.apiserverValues(),
                controller: this.controllerValues(),
                admission: this.admissionValues(),
                scheduler: this.schedulerValues(),
                defaultDomains: [{
                    domain: `${this.values.gardener.shootDomainPrefix}.${this.values.host}`,
                    provider: this.values.dns.provider,
                    credentials: base64EncodeMap(this.values.dns.credentials, {jsonIgnoreString: true}),
                }],
                internalDomain: {
                    domain: `internal.${this.values.host}`,
                    provider: this.values.dns.provider,
                    credentials: base64EncodeMap(this.values.dns.credentials, {jsonIgnoreString: true}),
                },
                deployment: {
                    virtualGarden: {
                        enabled: true,
                        clusterIP: new IPCIDR(this.values.hostCluster.network.serviceCIDR).toArray()[20],
                    },
                },
            },
        };
    }

    private apiserverValues() {
        return deepMergeObject({
            enabled: true,
            clusterIdentity: this.values.landscapeName,
            kubeconfig: 'dummy', // need to be set for the runtime chart
            featureGates: this.values.gardener.featureGates,
            image: {
                tag: this.version.raw,
            },
            caBundle: this.values.gardener.certs.ca.cert,
            tls: {
                crt: this.values.gardener.certs.apiserver.cert,
                key: this.values.gardener.certs.apiserver.privateKey,
            },
            etcd: {
                servers: 'https://garden-etcd-main.garden.svc:2379',
                useSidecar: false,
                caBundle: this.values.etcd.tls.ca.cert,
                tls: {
                    crt: this.values.etcd.tls.client.cert,
                    key: this.values.etcd.tls.client.privateKey,
                },
            },
            resources: defaultResources.apiserver,
            groupPriorityMinimum: 10000,
            insecureSkipTLSVerify: false,
            replicaCount: 1,
            serviceAccountName: 'gardener-apiserver',
            versionPriority: 20,
        }, this.values.gardener.apiserver);
    }

    private controllerValues() {
        return deepMergeObject({
            enabled: true,
            kubeconfig: 'dummy',
            image: {
                tag: this.version.raw,
            },
            resources: defaultResources.controller,
            replicaCount: 1,
            serviceAccountName: 'gardener-controller-manager',
            additionalVolumeMounts: [],
            additionalVolumes: [],
            alerting: [],
            config: {
                clientConnection: {
                    acceptContentTypes: 'application/json',
                    contentType: 'application/json',
                    qps: 100,
                    burst: 130,
                },
                logLevel: 'info',
                'controllers': {
                    'backupInfrastructure': {
                        'concurrentSyncs': 20,
                        'syncPeriod': '24h',
                    },
                    'seed': {
                        'concurrentSyncs': 5,
                        'reserveExcessCapacity': false,
                        'syncPeriod': '1m',
                    },
                    'shoot': {
                        'concurrentSyncs': 20,
                        'retryDuration': '24h',
                        'syncPeriod': '1h',
                    },
                    'shootCare': {
                        'concurrentSyncs': 5,
                        'conditionThresholds': {
                            'apiServerAvailable': '1m',
                            'controlPlaneHealthy': '1m',
                            'everyNodeReady': '5m',
                            'systemComponentsHealthy': '1m',
                        },
                        'syncPeriod': '30s',
                    },
                    'shootMaintenance': {
                        'concurrentSyncs': 5,
                    },
                    'shootQuota': {
                        'concurrentSyncs': 5,
                        'syncPeriod': '60m',
                    },
                },
                featureGates: this.values.gardener.featureGates,
                leaderElection: {
                    'leaderElect': true,
                    'leaseDuration': '15s',
                    'renewDeadline': '10s',
                    'retryPeriod': '2s',
                },
                server: this.version.compare('1.52.0') >= 0 ?
                    {
                        http: {
                            bindAddress: '0.0.0.0',
                            port: 2718,
                        },
                        https: {
                            bindAddress: '0.0.0.0',
                            port: 2719,
                            tls: {
                                caBundle: this.values.gardener.certs.ca.cert,
                                crt: this.values.gardener.certs.controllerManager.cert,
                                key: this.values.gardener.certs.controllerManager.privateKey,
                            },
                        },
                    }
                    : {
                        healthProbes: {
                            bindAddress: '0.0.0.0',
                            port: 2718,
                        },
                        metrics: {
                            bindAddress: '0.0.0.0',
                            port: 2719,
                        },
                    },
            },
        }, this.values.gardener.admission);
    }

    private admissionValues() {
        const v = {
            enabled: true,
            kubeconfig: 'dummy',
            image: {
                tag: this.version.raw,
            },
            resources: defaultResources.admission,
            replicaCount: 1,
            serviceAccountName: 'gardener-admission-controller',
            config: {
                gardenClientConnection: {
                    acceptContentTypes: 'application/json',
                    contentType: 'application/json',
                    qps: 100,
                    burst: 130,
                },
                server: {
                    webhooks: {
                        bindAddress: '0.0.0.0',
                        port: 2719,
                        tls: {
                            caBundle: this.values.gardener.certs.ca.cert,
                            crt: this.values.gardener.certs.admissionController.cert,
                            key: this.values.gardener.certs.admissionController.privateKey,
                        },
                    },
                },
            },
        } as Values;
        if (this.version.compare('1.57.0') === -1) {
            v.config.server.https = v.config.server.webhooks;
            delete v.config.server.webhooks;
        }
        return deepMergeObject(v, this.values.gardener.admission);
    }

    private schedulerValues(): Values {
        return deepMergeObject({
            enabled: true,
            kubeconfig: 'dummy',
            image: {
                tag: this.version.raw,
            },
            resources: defaultResources.scheduler,
            replicaCount: 1,
            serviceAccountName: 'gardener-scheduler',
            config: {
                schedulers: {
                    shoot: {
                        retrySyncPeriod: '1s',
                        concurrentSyncs: 5,
                        candidateDeterminationStrategy: this.values.gardener.seedCandidateDeterminationStrategy,
                    },
                },
            },
        }, this.values.gardener.scheduler);
    }

    private async getKubeConfigForServiceAccount(name: string): Promise<string> {
        if (!this.virtualClient) {
            return `dumy-${name}`;
        }
        const kc = await getKubeConfigForServiceAccount(this.virtualClient, GardenerNamespace, name, log);
        return kc.exportConfig();
    }

}

class RuntimeChart extends Chart<VersionedValues> {
    constructor(version: string, private readonly values: Values) {
        super(
            'gardener-runtime',
            new RemoteChartFromZip(GardenerRepoZipUrl(version), path.join(GardenerChartBasePath(version), 'runtime')),
            GardenerNamespace,
        );
    }

    public async renderValues(values: VersionedValues): Promise<Values> {
        return this.values;
    }
}

class ApplicationChart extends Chart<VersionedValues> {
    constructor(version: string, private readonly values: Values) {
        super(
            'gardener-application',
            new RemoteChartFromZip(GardenerRepoZipUrl(version), path.join(GardenerChartBasePath(version), 'application')),
            GardenSystemNamespace,
        );
    }

    public async renderValues(values: VersionedValues): Promise<Values> {
        return this.values;
    }
}

