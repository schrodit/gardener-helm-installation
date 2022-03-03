import { KeyValueState, State } from "./State";
import { has } from "../utils/has";
import { deepMergeObject } from "../utils/deepMerge";
import { KubeClient } from "../utils/KubeClient";
import { V1Secret } from "@kubernetes/client-node";
import { retryWithBackoff } from "../utils/exponentialBackoffRetry";
import { createOrUpdate, enrichKubernetesError, isNotFoundError } from "../utils/kubernetes";
import { createLogger } from "../log/Logger";

const log = createLogger('KubernetesState');

const secretStateKey = 'state';

const secretNamePrefix = 'gardener-installer-'

const secretName = (name: string): string => {
    return secretNamePrefix + name;
}

export const createSecret = (namespace:string, name: string): V1Secret => {
    return {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
            name,
            namespace,
        },
    };
}


class KubernetesStateBase<T> {
    private readonly secretName: string;

    constructor(
        private readonly kubeClient: KubeClient,
        private readonly name: string,
        private readonly namespace: string,
    ){
        this.secretName = secretName(this.name);
    }

    protected async storeInSecret(data: Record<string, T>): Promise<void> {
        const secret = createSecret(this.namespace, this.secretName);

        const raw: Record<string, string>  = {};
        for (const key in data) {
            raw[key] = Buffer.from(JSON.stringify(data[key]), 'utf-8').toString('base64');
        }

        await retryWithBackoff(async (): Promise<boolean> => {
            try {
                await createOrUpdate(this.kubeClient, secret, async (): Promise<void> => {
                    secret.data = raw;
                });
                return true;
            } catch (error) {
                log.error(enrichKubernetesError(secret, error));
                return false;
            }
        });
        log.info(`Successfully read state from ${this.secretName}`);
    }

    protected async getDataFromSecret(): Promise<Record<string, string> | undefined> {
        const secret = createSecret(this.namespace, this.secretName);

        await retryWithBackoff(async (): Promise<boolean> => {
            try {
                Object.assign(secret, (await this.kubeClient.read(secret)).body);
                return true;
            } catch (error) {
                if (isNotFoundError(error)) {
                    return true;
                }
                log.error(enrichKubernetesError(secret, error));
                return false;
            }
        });

        const content = secret.data?.[secretStateKey];
        if (!has(content)) {
            return undefined;
        }

        return secret.data!;
    }
} 

export class KubernetesState<T> extends KubernetesStateBase<T> implements State<T> {

    constructor(
        kubeClient: KubeClient,
        name: string,
        namespace: string,
        private readonly empty: T,
    ){
        super(kubeClient, name, namespace);
    }
    
    async get(): Promise<T> {
        const content = await this.getDataFromSecret();
        if (!has(content)) {
            return this.empty;
        }

        const obj = JSON.parse(Buffer.from(content![secretStateKey], 'base64').toString('utf-8'));
        return deepMergeObject(this.empty, obj);
    }

    async store(data: T): Promise<void> {
        await this.storeInSecret({
            [secretStateKey]: data,
        })
    }
    
}

export class KubernetesKeyValueState<T> extends KubernetesStateBase<T> implements KeyValueState<T> {
    private data?: Record<string, T>;

    async getAll(): Promise<Record<string, T>> {
        return await this.getData();
    }
    
    async get(key: string): Promise<T | undefined> {
        return (await this.getData())[key];
    }

    async store(key: string, data: T): Promise<void> {
        const d = await this.getData();
        d[key] = data;
        await this.storeInSecret(d);
    }

    private async getData(): Promise<Record<string, T>> {
        if (has(this.data)) {
            return this.data as Record<string, T>;
        }
        const raw = await this.getDataFromSecret();

        this.data = {};

        for (const key in raw) {
            this.data[key] = JSON.parse(Buffer.from(raw[key], 'base64').toString('utf-8'));
        }
        return this.data as Record<string, T>;
    }
    
}
