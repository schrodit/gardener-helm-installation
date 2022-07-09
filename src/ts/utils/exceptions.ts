
export class Exception extends Error {
    public constructor(msg: string) {
        super(msg);
        this.name = this.constructor.name;
    }
}

export class NotFound extends Exception {
    public constructor(msg: string) {
        super(msg);
    }
}
