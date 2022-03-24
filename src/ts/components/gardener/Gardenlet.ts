import path from 'path';
import {KubeConfig, KubernetesListObject, V1Secret} from '@kubernetes/client-node';
import {SemVer} from 'semver';
import {GardenerNamespace, GeneralValues, KubeSystemNamespace} from '../../Values';
import {createLogger} from '../../log/Logger';
import {Chart, Helm, RemoteChartFromZip, Values} from '../../plugins/Helm';
import {CharacterSet, randomString} from '../../utils/randomString';
import {retryWithBackoff} from '../../utils/exponentialBackoffRetry';
import {createOrUpdate, enrichKubernetesError, isNotFoundError} from '../../utils/kubernetes';
import {KubeClient} from '../../utils/KubeClient';
import {base64Encode} from '../../utils/base64Encode';
import {deepMergeObject} from '../../utils/deepMerge';
import {createSecret} from '../../state/KubernetesState';
import {base64Decode} from '../../utils/base64Decode';
import {waitUntilVirtualClusterIsReady} from '../VirtualCluster';
import {Backup, SeedBackupConfig} from '../Backup';
import {Task} from '../../flow/Flow';
import {GardenerChartsBasePath, GardenerRepoZipUrl} from './Gardener';

const log = createLogger('Gardenlet');

/* Export const Gardenlet = async (
    hostClient: KubeClient,
    helm: Helm,
    values: GeneralValues,
    state: KeyValueState<string>,
    dryRun: boolean,
): Promise<Step[]> => {
    const comp = new GardenerComponent(values, state);
    comp.setDefaultTask(new GardenletTask(
        hostClient, helm, values, dryRun,
    ));
    comp.addVersions(...SupportedVersions);

    return await new InstallationManager().getSteps(comp);
};*/

/**
 * Deploys the host gardenlet.
 * Based on https://github.com/gardener/gardener/blob/master/docs/deployment/deploy_gardenlet_manually.md
 */
export class GardenletTask extends Task {

    private virtualClient?: KubeClient;

    constructor(
        private readonly version: SemVer,
        private readonly hostClient: KubeClient,
        private readonly helm: Helm,
        private readonly values: GeneralValues,
        private readonly dryRun: boolean,
    ) {
        super('Gardenlet');
    }

    public async do(): Promise<void> {
        log.info('Installing Gardenlet');

        if (!this.dryRun) {
            this.virtualClient = await waitUntilVirtualClusterIsReady(log, this.values);
        }

        const gardenletKubeConfig = await this.initialGardenletKubeconfig(await this.createBoostrapSecret());
        const gardenletChart = new GardenletChart(
            this.version.raw,
            gardenletKubeConfig.exportConfig(),
            await this.getBackupConfig());
        await this.helm.createOrUpdate(await gardenletChart.getRelease(this.values));

        log.info('Gardenlet installed');
    }

    /**
     * Deploys the boostrap secret in the virtual cluster.
     * Returns the authentication token to be used for the kubeconfig.
     */
    private async createBoostrapSecret(): Promise<string> {
        if (this.dryRun) {
            return 'dummy-bootstrap-secret';
        }
        const token = await this.readTokenFromBootstrapSecret();
        if (token) {
            log.info('Gardenlet bootstrap secret does already exist. Use existing..');
            return token;
        }

        log.info('Create Gardenlet bootstrap secret');
        const tokenId = randomString(6, CharacterSet.AlphaNumericalLowerCase);
        const tokenSecret = randomString(16, CharacterSet.AlphaNumericalLowerCase);
        const bootstrapSecret: V1Secret = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
                name: `bootstrap-token-${tokenId}`,
                namespace: KubeSystemNamespace,
                labels: {
                    app: 'gardener-installer',
                    landscape: this.values.landscapeName,
                },
            },
            type: 'bootstrap.kubernetes.io/token',
            data: {
                description: base64Encode('Token to be used by the gardenlet for host seed.'),
                'token-id': base64Encode(tokenId),
                'token-secret': base64Encode(tokenSecret),
                'usage-bootstrap-authentication': base64Encode('true'),
                'usage-bootstrap-signing': base64Encode('true'),
            },
        };

        await retryWithBackoff(async (): Promise<boolean> => {
            try {
                await this.virtualClient?.create(bootstrapSecret);
                return true;
            } catch (error) {
                log.error(enrichKubernetesError(bootstrapSecret, error));
            }
            return false;
        });
        return `${tokenId}.${tokenSecret}`;
    }

    /**
     * Returns undefined if the secret does not exist
     */
    private async readTokenFromBootstrapSecret(): Promise<string | undefined> {
        if (!this.virtualClient) {
            return;
        }
        let token: string | undefined;

        await retryWithBackoff(async (): Promise<boolean> => {
            try {
                const secrets = (await this.virtualClient!.list('v1', 'Secret', KubeSystemNamespace,
                    undefined, undefined, undefined, undefined,
                    `app=gardener-installer,landscape=${this.values.landscapeName}`)).body as KubernetesListObject<V1Secret>;
                if (!secrets.items || secrets.items.length === 0) {
                    return true;
                }
                if (secrets.items.length !== 1) {
                    throw new Error(`Expected 1 gardenlet soil secret but found ${secrets.items.length}`);
                }
                const data = secrets.items[0].data!;
                const tokenId = base64Decode(data['token-id']);
                const tokenSecret = base64Decode(data['token-secret']);
                token = `${tokenId}.${tokenSecret}`;
                return true;
            } catch (error) {
                if (isNotFoundError(error)) {
                    return true;
                }
                log.error(enrichKubernetesError({}, error));
            }
            return false;
        });
        return token;
    }

    private initialGardenletKubeconfig(token: string): KubeConfig {
        if (this.dryRun) {
            return new KubeConfig();
        }
        const kc = new KubeConfig();
        const cluster = this.virtualClient?.getKubeConfig().getCurrentCluster();
        if (!cluster) {
            throw new Error('No cluster defined in virtual cluster kubeconfig');
        }
        kc.addCluster(cluster);
        kc.addUser({
            name: 'gardenlet-bootstrap',
            token,
        });
        kc.addContext({
            name: 'gardenlet-bootstrap@default',
            cluster: cluster.name,
            user: 'gardenlet-bootstrap',
        });
        kc.setCurrentContext('gardenlet-bootstrap@default');
        return kc;
    }

    private async getBackupConfig(): Promise<SeedBackupConfig | undefined> {
        if (!this.virtualClient) {
            return;
        }
        if (!this.values.backup && !this.values.gardener.soil.backup) {
            return;
        }
        const backup: Backup = deepMergeObject(this.values.backup!, this.values.gardener.soil.backup!);

        const backupSecretName = 'soil-backup-secret';
        const backupSecret = createSecret(GardenerNamespace, backupSecretName);
        log.info(`Creating soil backup secret "${backupSecretName}"`);
        await retryWithBackoff(async (): Promise<boolean> => {
            if (this.dryRun) {
                return true;
            }
            try {
                await createOrUpdate(this.virtualClient!, backupSecret, async (): Promise<void> => {
                    backupSecret.stringData = backup.credentials;
                });
                return true;
            } catch (error) {
                log.error(enrichKubernetesError(backupSecret, error));
            }
            return false;
        });

        return {
            provider: backup.provider,
            providerConfig: backup.providerConfig,
            region: backup.region,
            secretRef: {
                name: backupSecretName,
                namespace: GardenerNamespace,
            },
        };
    }

}

class GardenletChart extends Chart {
    constructor(
        private readonly version: string,
        private readonly gardenletKubeconfig: string,
        private readonly backupConfig?: SeedBackupConfig,
    ) {
        super(
            'gardenlet',
            new RemoteChartFromZip(GardenerRepoZipUrl(version), path.join(GardenerChartsBasePath(version), 'gardenlet')),
            GardenerNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            global: {
                gardenlet: {
                    image: {
                        tag: this.version,
                    },
                    config: this.gardenletConfig(values),
                },
                deployment: {
                    virtualGarden: {
                        enabled: true,
                    },
                },
            },
        };
    }

    private gardenletConfig(values: GeneralValues) {
        return {
            gardenClientConnection: {
                bootstrapKubeconfig: {
                    name: 'gardenlet-kubeconfig-bootstrap',
                    namespace: GardenerNamespace,
                    kubeconfig: this.gardenletKubeconfig,
                },
                kubeconfigSecret: {
                    name: 'gardenlet-kubeconfig',
                    namespace: GardenerNamespace,
                },
            },
            featureGates: {
                HVPA: true,
                ManagedIstio: true,
                APIServerSNI: true,
                CachedRuntimeClients: true,
                ReversedVPN: true,
                ...values.gardener.featureGates,
            },
            seedConfig: {
                apiVersion: 'core.gardener.cloud/v1beta1',
                kind: 'Seed',
                metadata: {
                    name: 'host',
                },
                spec: this.seedConfig(values),
            },
        };
    }

    private seedConfig(values: GeneralValues) {
        return {
            provider: {
                type: values.hostCluster.provider,
                region: values.hostCluster.region,
            },
            networks: {
                nodes: values.hostCluster.network.nodeCIDR,
                pods: values.hostCluster.network.podCIDR,
                services: values.hostCluster.network.serviceCIDR,
                shootDefaults: values.gardener.soil.shootDefaultNetworks,
                blockCIDRs: values.gardener.soil.blockCIDRs,
            },
            backup: this.backupConfig,
            dns: {
                ingressDomain: `host.${values.ingressHost}`,
            },
            settings: values.gardener.soil.settings,
        };
    }
}
