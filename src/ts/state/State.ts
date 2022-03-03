
export interface State<T> {
    get(): Promise<T>
    store(data: T): Promise<void>
}

export interface KeyValueState<T> {
    getAll(): Promise<Record<string, T>>
    get(key: string): Promise<T | undefined>
    store(key: string, data: T): Promise<void>
}
