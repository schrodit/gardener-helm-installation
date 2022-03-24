import {EventEmitter} from 'events';
import {createLogger} from '../log/Logger';

const log = createLogger('Flow');

export enum TaskEvents {
    COMPLETED = 'completed',
}

export abstract class Task extends EventEmitter {

    constructor(public name: string) {
        super();
    }

    public abstract do(): Promise<void>;
}

/**
 * Flow execution engine that can executed different tasks as DAG.
 */
export class Flow {

    private readonly tasks: Task[] = [];
    private executing: boolean = false;

    public addTasks(...tasks: Task[]) {
        if (this.executing) {
            throw new Error('Unable to add new tasks while executing');
        }
        this.tasks.push(...tasks);
    }

    public async execute(): Promise<void> {
        log.info('Starting execution flow');
        this.executing = true;

        // todo: add dag execution.
        for (const task of this.tasks) {
            await this.executeTask(task);
            task.emit(TaskEvents.COMPLETED);
        }
    }

    public taskNames(): string[] {
        return this.tasks.map(t => t.name);
    }

    private async executeTask(task: Task): Promise<void> {
        log.info('');
        log.info(`Start executing ${task.name}`, {task: task.name});

        await task.do();

        log.info(`Successfully executed ${task.name}`, {task: task.name});
    }

}
