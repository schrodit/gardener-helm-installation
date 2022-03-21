import {KeyValueState} from './State';

export class NamespacedKeyValueState<T> implements KeyValueState<T> {

    constructor(
        private readonly state: KeyValueState<any>,
        private readonly namespace: string,
    ) {
    }

    public async get(key: string): Promise<T | undefined> {
        return this.state.get(this.namespacedKey(key));
    }

    public async getAll(): Promise<Record<string, T>> {
        const values: Record<string, any> = {};
        for (const [key, value] of Object.entries(await this.state.getAll())) {
            if (key.startsWith(this.namespace)) {
                values[key.slice(this.namespace.length)] = value;
            }
        }
        return values;
    }

    public async store(key: string, data: T): Promise<void> {
        await this.state.store(this.namespacedKey(key), data);
    }

    private namespacedKey(key: string): string {
        return [this.namespace, key].join('.');
    }
}
