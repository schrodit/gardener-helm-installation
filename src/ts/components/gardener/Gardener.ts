import path from 'path';
import semver, {SemVer} from 'semver';
import {InstallationManager} from '../../flow/InstallationManager';
import {BaseComponent, BaseVersion} from '../../flow/BaseComponent';
import {trimPrefix} from '../../utils/trimPrefix';
import {KubeClient} from '../../utils/KubeClient';
import {Helm} from '../../plugins/Helm';
import {KeyValueState} from '../../state/State';
import {Task, TaskEvents} from '../../flow/Flow';
import {createLogger} from '../../log';
import {GeneralValues} from '../../Values';
import {CA, createClientTLS, createSelfSignedCA, defaultExtensions, TLS} from '../../utils/tls';
import {serviceHosts} from '../../utils/kubernetes';
import {DefaultGardenerTask} from './DefaultGardenerTask';

const log = createLogger('Gardener');

export const SupportedVersions: BaseVersion[] = [
    {version: new SemVer('v1.41.1')},
    {version: new SemVer('v1.41.2')},
    {version: new SemVer('v1.41.3')},
];

export const initialVersion = 'v1.41.1';

export const GardenerRepoZipUrl = (gardenerVersion: string) => `https://github.com/gardener/gardener/archive/refs/tags/${gardenerVersion}.zip`;
export const GardenerChartsBasePath = (gardenerVersion: string) => `gardener-${trimPrefix(gardenerVersion, 'v')}/charts/gardener`;
export const GardenerChartBasePath = (gardenerVersion: string) => path.join(GardenerChartsBasePath(gardenerVersion), 'controlplane/charts');

export const LastVersionStateKey = 'gardenerVersion';

export interface GardenerCertificates {
    ca: CA,
    apiserver: TLS,
    controllerManager: TLS,
    admissionController: TLS,
}

export const Gardener = async (
    hostClient: KubeClient,
    helm: Helm,
    values: GeneralValues,
    state: KeyValueState<string>,
    dryRun: boolean,
): Promise<Task[]> => {
    const comp = new GardenerComponent(values, state);
    comp.setDefaultTask(new DefaultGardenerTask(
        hostClient, helm, values, dryRun
    ));
    comp.addVersions(...SupportedVersions);

    return await new InstallationManager().getTasks(comp);
};

export class GardenerComponent extends BaseComponent {

    constructor(
        private readonly values: GeneralValues,
        private readonly state: KeyValueState<string>,
    ) {
        super('Gardener');
    }

    public async getCurrentVersion(): Promise<SemVer | undefined> {
        const v = await this.state.get(LastVersionStateKey);
        return v ? new SemVer(v) : undefined;
    }

    public async getTargetVersion(): Promise<SemVer> {
        if (this.values.gardener.version) {
            return new SemVer(this.values.gardener.version);
        }
        // default target version to latest available
        return semver.rsort(this.versions.map(v => v.version))[0] as SemVer;
    }

    public async install(version: SemVer): Promise<Task> {
        const task = await super.install(version);
        task.on(TaskEvents.COMPLETED, () => {
            this.state.store(LastVersionStateKey, version.raw);
        });
        return task;
    }
}

export const generateGardenerCerts = (
    gardenNamespace: string,
    ca: CA = createSelfSignedCA('ca-gardener'),
): GardenerCertificates => {

    const apiserver = createClientTLS(ca, {
        cn: 'gardener-apiserver',
        extensions: defaultExtensions(),
        altNames: serviceHosts('gardener-apiserver', gardenNamespace),
    });
    const controllerManager = createClientTLS(ca, {
        cn: 'gardener-controller-manager',
        extensions: defaultExtensions(),
        altNames: serviceHosts('gardener-controller-manager', gardenNamespace),
    });
    const admissionController = createClientTLS(ca, {
        cn: 'gardener-admission-controller',
        extensions: defaultExtensions(),
        altNames: serviceHosts('gardener-admission-controller', gardenNamespace),
    });

    return {
        ca,
        apiserver,
        controllerManager,
        admissionController,
    };
};
