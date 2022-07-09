import {Component, Version} from './InstallationManager';
import {Step, Task} from './Flow';
import {SemVer} from 'semver';

export interface BaseVersion extends Version {
    task?: Task,
}

export interface VersionedStepFactory {
    createVersion(version: SemVer): Step
}

export abstract class BaseComponent implements Component {
    protected readonly versions: BaseVersion[] = [];

    constructor(
        public readonly name: string,
        private defaultStepFactory?: VersionedStepFactory,
    ) {
    }

    public abstract getCurrentVersion(): Promise<SemVer | undefined>;
    public abstract getTargetVersion(): Promise<SemVer>;

    public addVersions(...versions: BaseVersion[]) {
        this.versions.push(...versions);
    }

    public setDefaultStepFactory(factory: VersionedStepFactory) {
        this.defaultStepFactory = factory;
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
        if (!this.defaultStepFactory) {
            throw new Error(`No default Installation task for version ${version.raw} defined`);
        }
        const step = this.defaultStepFactory.createVersion(version);
        step.name = `${step.name}-${version.raw}`;
        return step;
    }

}
