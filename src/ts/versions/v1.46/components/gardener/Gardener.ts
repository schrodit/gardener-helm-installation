import path from 'path';
import {SemVer} from 'semver';
import {createLogger} from '../../../../log/Logger';
import {trimPrefix} from '../../../../utils/trimPrefix';
import {CA, createClientTLS, createSelfSignedCA, defaultExtensions, TLS} from '../../../../utils/tls';
import {KubeClient} from '../../../../utils/KubeClient';
import {Helm} from '../../../../plugins/Helm';
import {Step} from '../../../../flow/Flow';
import {serviceHosts} from '../../../../utils/kubernetes';
import {GardenletTask, GardenletValues} from './Gardenlet';
import {Controlplane, ControlplaneValues} from './Controlplane';

const log = createLogger('Gardener');

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
    version: string,
    hostClient: KubeClient,
    helm: Helm,
    values: ControlplaneValues & GardenletValues,
    dryRun: boolean,
): Promise<Step[]> => {
    return [
        new Controlplane(
            new SemVer(version), hostClient, helm, values, dryRun
        ),
        new GardenletTask(
            new SemVer(version), hostClient, helm, values, dryRun,
        ),
    ];
};

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
