import {deepMergeObject} from '../utils/deepMerge';
import {KeyValueState, State} from './State';

export class FakeState<T> implements State<T> {
    private data?: T;

    constructor(
        private readonly empty: T,
    ) {
    }

    public async get(): Promise<T> {
        if (!this.data) {
            return this.empty;
        }
        return deepMergeObject(this.empty, this.data);
    }

    public async store(data: T): Promise<void> {
        this.data = data;
    }

}

export class FakeKeyValueState<T> implements KeyValueState<T> {
    private data: Record<string, T> = {};

    public async getAll(): Promise<Record<string, T>> {
        return this.data;
    }

    public async get(key: string): Promise<T | undefined> {
        return this.data[key];
    }

    public async store(key: string, data: T): Promise<void> {
        this.data[key] = data;
    }
}
