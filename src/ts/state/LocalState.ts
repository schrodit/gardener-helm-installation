import { access, mkdir, readFile, writeFile } from "fs/promises";
import { KeyValueState, State } from "./State";
import path from 'path';
import { has } from "../utils/has";
import { merge } from "@0cfg/utils-common/lib/merge";
import { deepMergeObject } from "../utils/deepMerge";


export class LocalState<T> implements State<T> {

    constructor(
        private readonly stateFile: string,
        private readonly empty: T,
    ){}
    
    async get(): Promise<T> {
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

    async store(data: T): Promise<void> {
        const stateDir = path.dirname(this.stateFile);
        try {
            await access(stateDir);
        } catch (error) {
            await mkdir(stateDir);
        }
        await writeFile(this.stateFile, JSON.stringify(data, null, '  '), 'utf-8');
    }
    
}

export class LocalKeyValueState<T> implements KeyValueState<T> {

    private state: LocalState<Record<string, T>>;
    private data?: Record<string, T>;

    constructor(
        stateFile: string,
    ){
        this.state = new LocalState<Record<string, T>>(stateFile, {});
    }

    async getAll(): Promise<Record<string, T>> {
        return await this.getData();
    }
    
    async get(key: string): Promise<T | undefined> {
        return (await this.getData())[key];
    }

    async store(key: string, data: T): Promise<void> {
        const d = await this.getData();
        d[key] = data

        await this.state.store(d);
    }

    private async getData(): Promise<Record<string, T>> {
        if (has(this.data)) {
            return this.data as Record<string, T>;
        }
        this.data = await this.state.get();
        return this.data as Record<string, T>;
    }
    
}
