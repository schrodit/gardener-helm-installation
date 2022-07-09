import {EventEmitter} from 'events';
import {createLogger} from '../log/Logger';
import {Values} from "../plugins/Helm";

const log = createLogger('Flow');

export type VersionedValues = {
    version: string;
}

export enum StepEvents {
    COMPLETED = 'completed',
}

export abstract class Task extends EventEmitter {

    constructor(public name: string) {
        super();
    }

    public abstract do(): Promise<void>;
}

export type Step = Task | Flow

export interface StepInfo {
    name: string;
    steps?: StepInfo[];
}

/**
 * Flow execution engine that can executed different tasks in serial steps.
 */
export class Flow extends EventEmitter {

    private readonly steps: Step[] = [];
    private executing: boolean = false;

    constructor(
        public name: string,
        ...steps: Step[]
    ) {
        super();
        this.steps = steps;
    }

    public addSteps(...steps: Step[]) {
        if (this.executing) {
            throw new Error('Unable to add new tasks while executing');
        }
        this.steps.push(...steps);
    }

    public async execute(): Promise<void> {
        log.info(`Starting execution flow ${this.name}`);
        this.executing = true;

        // todo: add dag execution.
        for (const step of this.steps) {
            if (step instanceof Task) {
                await this.executeTask(step);
                step.emit(StepEvents.COMPLETED);
            } else if (step instanceof Flow) {
                await step.execute();
            } else {
                throw new Error('Unknown step type');
            }
        }
        this.emit(StepEvents.COMPLETED);
    }

    public getStepInfo(): StepInfo[] {
        return this.steps.map(t => {
            return {
                name: t.name,
                steps: t instanceof Flow ? t.getStepInfo() : undefined,
            };
        });
    }

    private async executeTask(task: Task): Promise<void> {
        log.info('');
        log.info(`Start executing ${task.name}`, {task: task.name});

        await task.do();

        log.info(`Successfully executed ${task.name}`, {task: task.name});
    }

}
