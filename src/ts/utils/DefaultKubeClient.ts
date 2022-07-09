import {URL} from 'url';
import {KubeConfig, KubernetesObjectApi, RequestResult, Watch} from '@kubernetes/client-node';
import {has} from '@0cfg/utils-common/lib/has';
import {KubeClient, KubernetesEventType, WatchObject} from './KubeClient';

export class DefaultKubeClient extends KubernetesObjectApi implements KubeClient {
    private readonly kubeConfig: KubeConfig;
    private watcher: Watch;

    public constructor(kubeConfig: KubeConfig) {
        const cluster = kubeConfig.getCurrentCluster();
        if (!has(cluster)) {
            throw new Error('No active cluster defined');
        }
        super(cluster.server);
        this.kubeConfig = kubeConfig;
        this.setDefaultAuthentication(kubeConfig);
        this.setDefaultNamespace(kubeConfig);
        this.watcher = new Watch(kubeConfig);
    }

    public getKubeConfig(): KubeConfig {
        return this.kubeConfig;
    }

    public async watch(
        path: string,
        queryParams: Record<string, any>,
        callback: (type: KubernetesEventType, apiObj: any, watchObj?: WatchObject) => void,
        done: (err: any) => void,
    ): Promise<RequestResult> {
        return this.watcher.watch(
            path,
            queryParams,
            callback as (phase: string, apiObj: any, watchObj?: any) => void,
            done,
        );
    }

    /**
     * Returns the api path for a kubernetes resource as it is needed by the watch method.
     */
    public async getAPIResourcePath(apiVersion: string, kind: string, namespace?: string): Promise<string> {
        const url = new URL(await this.specUriPath({
            apiVersion,
            kind,
            metadata: {
                namespace,
            },
        }, 'list'));
        return url.pathname;
    }
}
