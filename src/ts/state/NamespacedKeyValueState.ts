import {KeyValueState} from './State';

export class NamespacedKeyValueState implements KeyValueState {

    constructor(
        private readonly state: KeyValueState,
        private readonly namespace: string,
    ) {
    }

    public async get<T>(key: string): Promise<T> {
        return this.state.get<T>(this.namespacedKey(key));
    }

    public async store<T>(key: string, data: T): Promise<void> {
        await this.state.store(this.namespacedKey(key), JSON.stringify(data));
    }

    private namespacedKey(key: string): string {
        return [this.namespace, key].join('.');
    }
}
