import {Task} from './Flow';

export class DefaultTask extends Task {

    constructor(name: string, private readonly doFunc: () => Promise<void>) {
        super(name);
    }

    public do(): Promise<void> {
        return this.doFunc();
    }
}
