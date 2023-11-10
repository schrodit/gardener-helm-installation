import {access, mkdir, readFile, writeFile} from 'fs/promises';
import path from 'path';
import {has} from '../utils/has';
import {deepMergeObject} from '../utils/deepMerge';
import {NotFound} from '../utils/exceptions';
import {KeyValueState, State} from './State';

export class LocalState<T extends object> implements State<T> {

    constructor(
        private readonly stateFile: string,
        private readonly empty: T,
    ) {}

    public async get(): Promise<T> {
        try {
            await access(this.stateFile);
        } catch (error: any) {
            if (has(error.code) && error.code === 'ENOENT') {
                return this.empty;
            }
            throw error;
        }
        const obj = JSON.parse(await readFile(this.stateFile, 'utf-8'));
        return deepMergeObject(this.empty, obj);
    }

    public async store(data: T): Promise<void> {
        const stateDir = path.dirname(this.stateFile);
        try {
            await access(stateDir);
        } catch (error) {
            await mkdir(stateDir);
        }
        await writeFile(this.stateFile, JSON.stringify(data, null, '  '), 'utf-8');
    }

}

export class LocalKeyValueState implements KeyValueState {

    private state: LocalState<Record<string, any>>;
    private data?: Record<string, any>;

    constructor(
        stateFile: string,
    ) {
        this.state = new LocalState<Record<string, string>>(stateFile, {});
    }

    public async get<T>(key: string): Promise<T> {
        const d = (await this.getData())[key];
        if (!has(d)) {
            throw new NotFound(`${key} not found in local state`);
        }
        return d as T;
    }

    public async store<T>(key: string, data: T): Promise<void> {
        const d = await this.getData();
        d[key] = data;
        this.data = d;
        await this.state.store(d);
    }

    private async getData(): Promise<Record<string, any>> {
        if (has(this.data)) {
            return this.data as Record<string, any>;
        }
        this.data = await this.state.get();
        return this.data as Record<string, any>;
    }

}
