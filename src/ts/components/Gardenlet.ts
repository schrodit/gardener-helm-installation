import path from 'path';
import {KubeConfig, V1Secret} from '@kubernetes/client-node';
import {GardenerNamespace, GeneralValues, KubeSystemNamespace} from '../Values';
import {createLogger} from '../log/Logger';
import {Chart, Helm, RemoteChartFromZip, Values} from '../plugins/Helm';
import {Task} from '../flow/Flow';
import {randomString} from '../utils/randomString';
import {retryWithBackoff} from '../utils/exponentialBackoffRetry';
import {enrichKubernetesError} from '../utils/kubernetes';
import {KubeClient} from '../utils/KubeClient';
import {base64Encode} from '../utils/base64Encode';
import {GardenerChartsBasePath, GardenerRepoZipUrl, GardenerVersion} from './Gardener';
import {waitUntilVirtualClusterIsReady} from './VirtualCluster';

const log = createLogger('Gardenlet');

/**
 * Deploys the host gardenlet.
 * Based on https://github.com/gardener/gardener/blob/master/docs/deployment/deploy_gardenlet_manually.md
 */
export class Gardenlet extends Task {

    private virtualClient?: KubeClient;

    constructor(
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
        const gardenletChart = new GardenletChart(gardenletKubeConfig.exportConfig());
        await this.helm.createOrUpdate(await gardenletChart.getRelease(this.values), this.virtualClient?.getKubeConfig());

        log.info('Gardenlet installed');
    }

    /**
     * Deploys the boostrap secret in the virtual cluster.
     * Returns the authentication token to be used for the kubeconfig.
     */
    private async createBoostrapSecret(): Promise<string> {
        log.info('Create Gardenlet bootstrap secret');
        const tokenId = randomString(6);
        const tokenSecret = randomString(16);
        const bootstrapSecret: V1Secret = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
                name: `bootstrap-token-${tokenId}`,
                namespace: KubeSystemNamespace,
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
            } catch (error) {
                log.error(enrichKubernetesError(bootstrapSecret, error));
            }
            return false;
        });
        return `${tokenId}.${tokenSecret}`;
    }

    private initialGardenletKubeconfig(token: string): KubeConfig {
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

}

class GardenletChart extends Chart {
    constructor(private readonly gardenletKubeconfig: string) {
        super(
            'gardenlet',
            new RemoteChartFromZip(GardenerRepoZipUrl, path.join(GardenerChartsBasePath, 'gardenlet')),
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return {
            global: {
                gardenlet: {
                    image: {
                        tag: GardenerVersion,
                    },
                    config: this.gardenletConfig(values),
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
            seedConfig: {
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
            dns: {
                provider: {
                    type: values.dns.provider,
                    credentials: values.dns.credentials,
                },
                ingressDomain: `host.${values.ingressHost}`,
            },
            settings: values.gardener.soil.settings,
        };
    }
}
