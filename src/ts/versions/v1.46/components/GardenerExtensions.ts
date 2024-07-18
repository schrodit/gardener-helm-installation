import {readFile} from 'fs/promises';
import path from 'path';
import {URL} from 'url';
import * as YAML from 'yaml';
import {GeneralValues, required} from '../Values';
import {createLogger} from '../../../log/Logger';
import {Values} from '../../../plugins/Helm';
import {KubeApplyFactory} from '../../../flow/KubeApplyTask';
import {Flow, Task} from '../../../flow/Flow';
import {KubeClient} from '../../../utils/KubeClient';
import {DownloadManager} from '../../../utils/DownloadManager';
import {RawManifest} from '../../../plugins/KubeApply';
import {isV1Beta1ControllerRegistration, LabelSelector, V1Beta1ControllerRegistration} from '../../../api/ControllerRegistration';
import {isV1Beta1DeploymentRegistration, isV1DeploymentRegistration, V1Beta1ControllerDeployment, V1ControllerDeployment} from '../../../api/ControllerDeployment';
import {deepMergeObject} from '../../../utils/deepMerge';
import {trimPrefix} from '../../../utils/trimPrefix';
import {waitUntilVirtualClusterIsReady} from './VirtualCluster';

const log = createLogger('GardenerExtensions');

export interface GardenerExtension {
    enabled?: boolean,
    global?: boolean,
    primary?: boolean,
    version: string,
    controllerRegistration: RepositoryControllerRegistration,
    values?: Values,
    seedSelector?: LabelSelector,
}

export const GardenerExtensions = async (
    applyFactory: KubeApplyFactory,
    values: GeneralValues,
    genDir: string,
    dryRun: boolean,
): Promise<Flow> => {
    const tasks = await new GardenerExtensionsTask(
        applyFactory,
        values,
        genDir,
        dryRun,
    ).getTasks();
    return new Flow('GardenerExtensions', ...tasks);
};

export class GardenerExtensionsTask extends Task {

    private virtualClient?: KubeClient;
    private dm: DownloadManager;

    constructor(
        private readonly applyFactory: KubeApplyFactory,
        private readonly values: GeneralValues,
        private readonly genDir: string,
        private readonly dryRun: boolean,
    ) {
        super('GardenerExtensions');
        for (const [name, extension] of Object.entries(values.gardener.extensions)) {
            validateExtension(extension);
        }
        this.dm = new DownloadManager(genDir);
    }

    public async getTasks(): Promise<Task[]> {
        if (!this.dryRun) {
            this.virtualClient = await waitUntilVirtualClusterIsReady(log, this.values);
        }
        return await this.parseExtensions();
    }

    public async do(): Promise<void> {
        log.info('Installing Gardener Extensions');

        const flow = new Flow('');
        flow.addSteps(...await this.getTasks());
        await flow.execute();
    }

    private async parseExtensions(): Promise<Task[]> {
        const tasks = [];
        for (const [name, extension] of Object.entries(this.values.gardener.extensions)) {
            if (!(extension.enabled ?? true)) {
                log.info(`Extension ${name} disabled. Skipping...`);
                continue;
            }
            validateExtension(extension);
            const registration = await this.getRegistration(name, extension);
            const regManifest = registration.deploymentV1beta1 ?? registration.deploymentV1;
            if (!regManifest) {
                throw new Error(`Registration object is missing for ${extension}`);
            }
            const manifest = new RawManifest(name, regManifest, registration.registration);
            tasks.push(this.applyFactory.createTask(manifest, this.virtualClient));
        }
        return tasks;
    }

    private async getRegistration(name: string, extension: GardenerExtension): Promise<ControllerRegistration> {
        log.info(`Installing Gardener Extension ${name}`);
        const url = githubReleaseZipUrl(repositoryUrl(extension.controllerRegistration), extension.version);
        log.info(`Download controller registration from ${url}`);
        const extractedDir = await this.dm.downloadAndExtractZip(url);

        const registration = YAML.parseAllDocuments(await readFile(
            path.join(
                extractedDir,
                repositoryBasePath(extension.controllerRegistration.repositoryName, extension.version),
                extension.controllerRegistration.path ?? defaultControllerRegistrationPath,
            ),
            'utf-8',
        )).map(doc => doc.toJSON());
        const reg: ControllerRegistration = {
            registration: registration.find(doc => isV1Beta1ControllerRegistration(doc)),
            deploymentV1beta1: registration.find(doc => isV1Beta1DeploymentRegistration(doc)),
            deploymentV1: registration.find(doc => isV1DeploymentRegistration(doc)),
        };

        if (reg.deploymentV1beta1) {
            reg.deploymentV1beta1.providerConfig.values = deepMergeObject(reg.deploymentV1beta1.providerConfig.values, this.getDeploymentValues(extension));
        } else if (reg.deploymentV1) {
            reg.deploymentV1.helm.values = deepMergeObject(reg.deploymentV1.helm.values, this.getDeploymentValues(extension));
        }
        

        for (const i in reg.registration.spec.resources) {
            if (extension.primary === false) {
                reg.registration.spec.resources[i].primary = false;
            }
            reg.registration.spec.resources[i].globallyEnabled = extension.global;
        }
        reg.registration.spec.deployment.seedSelector = extension.seedSelector;

        return reg;
    }

    private getDeploymentValues(extension: GardenerExtension): Values {
        return deepMergeObject({
                image: {
                    tag: extension.version,
                },
            }, extension.values);
    }

}

interface ControllerRegistration {
    registration: V1Beta1ControllerRegistration,
    deploymentV1beta1?: V1Beta1ControllerDeployment,
    deploymentV1?: V1ControllerDeployment,
}

const validateExtension = (extension: GardenerExtension): void => {
    required(extension, 'version');
    required(extension, 'controllerRegistration');
};

/**
 * Defines a remote chart from a default gardener extension that follows the default structure.
 * The chart must be located at <repo-root>/charts/<repo-name>
 */
export interface RepositoryControllerRegistration {
    repositoryName: string,
    org?: string, // defaults to gardener
    githubBaseUrl?: string, // defaults to https://github.com
    path?: string,
}

const repositoryUrl = (rep: RepositoryControllerRegistration): string => {
    const url = new URL(path.join(
        rep.org ?? 'gardener',
        rep.repositoryName,
    ), rep.githubBaseUrl ?? 'https://github.com/');
    return url.toString();
};

const githubReleaseZipUrl = (repositoryUrl: string, version: string): string => {
    return `${repositoryUrl}/archive/refs/tags/${version}.zip`;
};

const repositoryBasePath = (repositoryName: string, version: string): string => {
    return `${repositoryName}-${trimPrefix(version, 'v')}`;
};

const defaultControllerRegistrationPath = '/example/controller-registration.yaml';

const defaultChartPath = (name: string): string => {
    return `charts/${name}`;
};
