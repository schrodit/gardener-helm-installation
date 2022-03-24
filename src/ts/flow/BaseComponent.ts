import {SemVer} from 'semver';
import {Component, Version} from './InstallationManager';
import {Task} from './Flow';
import {DefaultGardenerTask} from "../components/gardener/DefaultGardenerTask";

export interface BaseVersion extends Version {
    task?: Task,
}

export abstract class DefaultTask extends Task {
    protected version!: SemVer;

    public setVersion(version: SemVer) {
        this.version = version;
    }

    public abstract copy(): DefaultTask;
}

export abstract class BaseComponent implements Component {
    protected readonly versions: BaseVersion[] = [];

    constructor(
        public readonly name: string,
        private defaultTask?: DefaultTask,
    ) {
    }

    public abstract getCurrentVersion(): Promise<SemVer | undefined>;
    public abstract getTargetVersion(): Promise<SemVer>;

    public addVersions(...versions: BaseVersion[]) {
        this.versions.push(...versions);
    }

    public setDefaultTask(task: DefaultTask) {
        this.defaultTask = task;
    }

    public async getVersions(): Promise<Version[]> {
        return this.versions;
    }

    public async install(version: SemVer): Promise<Task> {
        const v = this.versions.find(v => v.version.compare(version));
        if (!v) {
            throw new Error(`No Installation task for version ${version.raw} defined`);
        }
        if (v.task) {
            return v.task;
        }
        if (!this.defaultTask) {
            throw new Error(`No default Installation task for version ${version.raw} defined`);
        }
        const task = this.defaultTask.copy();
        task.name = `${task.name}-${version.raw}`;
        task.setVersion(version);
        return task;
    }

}
