import {has} from '@0cfg/utils-common/lib/has';
import {deepMergeObject} from '../utils/deepMerge';
import {NotFound} from '../utils/exceptions';
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

export class FakeKeyValueState implements KeyValueState {
    private data: Record<string, any> = {};

    public async get<T>(key: string): Promise<T> {
        const v = this.data[key];
        if (!has(v)) {
            throw new NotFound(`${key} not found`);
        }
        return v;
    }

    public async store<T>(key: string, data: T): Promise<void> {
        this.data[key] = data;
    }
}
