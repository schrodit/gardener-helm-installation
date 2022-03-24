import {SemVer} from 'semver';
import {Component, Version} from './InstallationManager';
import {Step, Task} from './Flow';

export interface BaseVersion extends Version {
    task?: Task,
}

export abstract class VersionedTask extends Task {
    protected version!: SemVer;

    public setVersion(version: SemVer) {
        this.version = version;
    }

    public abstract copy(): VersionedTask;
}

export interface VersionedStepFactory {
    createVersion(version: SemVer): Step
}

export abstract class BaseComponent implements Component {
    protected readonly versions: BaseVersion[] = [];

    constructor(
        public readonly name: string,
        private defaultTask?: VersionedStepFactory,
    ) {
    }

    public abstract getCurrentVersion(): Promise<SemVer | undefined>;
    public abstract getTargetVersion(): Promise<SemVer>;

    public addVersions(...versions: BaseVersion[]) {
        this.versions.push(...versions);
    }

    public setDefaultTask(factory: VersionedStepFactory) {
        this.defaultTask = factory;
    }

    public async getVersions(): Promise<Version[]> {
        return this.versions;
    }

    public async install(version: SemVer): Promise<Step> {
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
        const step = this.defaultTask.createVersion(version);
        step.name = `${step.name}-${version.raw}`;
        return step;
    }

}
