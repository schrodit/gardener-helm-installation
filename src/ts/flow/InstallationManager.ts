import {SemVer} from 'semver';
import semver from 'semver';
import {createLogger} from '../log';
import {Flow, Step, Task} from './Flow';

const log = createLogger('InstallationManager');

export interface Component {
    name: string;
    /**
     * Get version that should be deployed;
     */
    getTargetVersion(): Promise<SemVer>;

    /**
     * Get current installed version
     */
    getCurrentVersion(): Promise<SemVer | undefined>;

    /**
     * Get all available versions.
     * Including possible the ones that includes migrations.
     */
    getVersions(): Promise<Version[]>;

    /**
     * Install the specific version of a component.
     * The function should wait until all components are healthy and optionally successfully migrated.
     * @param version version to install
     */
    install(version: SemVer): Promise<Step>;
}

export interface Version {
    version: SemVer;
    hasMigration?: boolean;
}

export class InstallationTask extends Task {
    constructor(
        private readonly component: Component,
        private readonly installationManager: InstallationManager = new InstallationManager(),
    ) {
        super(component.name);
    }

    public async do(): Promise<void> {
        await this.installationManager.install(this.component);
    }
}

/**
 * Manager to install components.
 */
export class InstallationManager {

    constructor(
        private readonly flow: Flow = new Flow(''),
    ) {
    }

    public async getSteps(component: Component): Promise<Step[]> {
        const steps: Promise<Step>[] = [];
        const currentVersion = await component.getCurrentVersion();
        const targetVersion = await component.getTargetVersion();

        if (!currentVersion) {
            // initial install
            return [await component.install(targetVersion)];
        }
        getVersionsToInstall(
            currentVersion,
            targetVersion,
            await component.getVersions(),
        ).forEach((v) => {
            steps.push(component.install(v));
        });
        return await Promise.all(steps);
    }

    /**
     * Updates a component to a specific target version.
     * Patch versions are skipped
     * but all available migrations are performed on the way
     * regardless of a major, minor or patch update
     * @param targetVersion
     */
    public async install(component: Component): Promise<void> {
        this.flow.addSteps(...(await this.getSteps(component)));
        await this.flow.execute();
    }
}

/**
 * Returns a list of all versions to install
 * @private
 */
export const getVersionsToInstall = (
    currentVersion: SemVer,
    targetVersion: SemVer,
    versions: Version[]
): SemVer[] => {
    let lowerBound = semver.inc(currentVersion.version, 'minor');
    // include the current minor if the target version is in range
    if (semver.satisfies(targetVersion, `~${currentVersion.version}`)) {
        lowerBound = currentVersion.version;
    }
    const inVersionRange = `${lowerBound} - ${targetVersion.version}`;

    const allAvailableVersions = versions.filter(v => semver.satisfies(v.version, inVersionRange));
    const allVersions = allAvailableVersions.map(v => v.version);
    const targetVersions: SemVer[] = allAvailableVersions.filter(v => {
        if (v.hasMigration) {
            return true;
        }
        const minSatisfying = semver.maxSatisfying(allVersions, `~${v.version.major}.${v.version.minor}`);
        return v.version.version === minSatisfying?.version;
    }).map(v => v.version);

    return semver.sort(targetVersions);
};
