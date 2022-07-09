
export interface State<T> {
    get(): Promise<T>
    store(data: T): Promise<void>
}

export interface KeyValueState {
    /**
     *
     * @throws NotFound
     */
    get<T>(key: string): Promise<T>
    store<T>(key: string, data: T): Promise<void>
}
