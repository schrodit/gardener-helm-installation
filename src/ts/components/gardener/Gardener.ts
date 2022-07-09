import path from 'path';
import semver, {SemVer} from 'semver';
import {InstallationManager} from '../../flow/InstallationManager';
import {BaseComponent, BaseVersion, VersionedStepFactory} from '../../flow/BaseComponent';
import {trimPrefix} from '../../utils/trimPrefix';
import {KubeClient} from '../../utils/KubeClient';
import {Helm} from '../../plugins/Helm';
import {KeyValueState} from '../../state/State';
import {StepEvents, Step, Flow} from '../../flow/Flow';
import {createLogger} from '../../log/Logger';
import {GeneralValues} from '../../Values';
import {CA, createClientTLS, createSelfSignedCA, defaultExtensions, TLS} from '../../utils/tls';
import {serviceHosts} from '../../utils/kubernetes';
import {Controlplane} from './Controlplane';
import {GardenletTask} from './Gardenlet';

const log = createLogger('Gardener');

export const SupportedVersions: BaseVersion[] = [
    {version: new SemVer('v1.41.1')},
    {version: new SemVer('v1.41.2')},
    {version: new SemVer('v1.41.3')},
    {version: new SemVer('v1.42.5')},
    {version: new SemVer('v1.43.2')},
    {version: new SemVer('v1.44.2')},
    {version: new SemVer('v1.44.6')},
    {version: new SemVer('v1.45.1')},
    {version: new SemVer('v1.46.2')},
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
): Promise<Step[]> => {
    const comp = new GardenerComponent(values, state);
    comp.setDefaultStepFactory(new GardenerStepFactory(
        hostClient, helm, values, dryRun
    ));
    comp.addVersions(...SupportedVersions);

    return await new InstallationManager().getSteps(comp);
};

class GardenerStepFactory implements VersionedStepFactory {

    constructor(
        private readonly hostClient: KubeClient,
        private readonly helm: Helm,
        private readonly values: GeneralValues,
        private readonly dryRun: boolean,
    ) {
    }

    public createVersion(version: SemVer): Step {
        return new Flow('Gardener',
            new Controlplane(
                version, this.hostClient, this.helm, this.values, this.dryRun
            ),
            new GardenletTask(
                version, this.hostClient, this.helm, this.values, this.dryRun,
            )
        );
    }

}

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

    public async install(version: SemVer): Promise<Step> {
        const step = await super.install(version);
        step.on(StepEvents.COMPLETED, () => {
            this.state.store(LastVersionStateKey, version.raw);
        });
        return step;
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
