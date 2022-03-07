import {Chart, ChartPath, Helm, Values} from '../plugins/Helm';
import {GardenSystemNamespace, GeneralValues} from '../Values';
import {KubeClient} from '../utils/KubeClient';
import {createLogger} from '../log/Logger';
import {waitUntilVirtualClusterIsReady} from './VirtualCluster';
import {Task} from "../flow/Flow";

const log = createLogger('GardenerInitConfig');

export interface GardenerInitConfig {
    defaultOwner?: User,
    defaultMembers?: User[],
    projects: ProjectConfig[],

    defaultKubernetesVersions?: ExpiringVersion[],
    cloudProfiles: CloudProfileConfig[],
}

export interface ProjectConfig {
    name: string,
    owner?: User,
    description?: string,
    purpose?: string,
    members?: User[],
}

// See https://github.com/gardener/gardener/blob/master/docs/usage/projects.md
export enum GardenerUserRole {
    ADMIN = 'admin',
    UAM = 'uam',
    VIEWER = 'viewer',
    OWNER = 'owner',
}

export interface User {
    apiGroup: string,
    kind: string,
    name: string,
    role: GardenerUserRole | string, // admin, viewer
    roles?: string[]
}

export interface CloudProfileConfig {
    name: string,
    spec: CloudProfileSpec,
}

export interface CloudProfileSpec {
    type: string,
    providerConfig: unknown,
    kubernetes: {
        versions: ExpiringVersion[],
    },
    machineImages: MachineImage[],
    machineTypes: MachineType[],
    volumeTypes: VolumeType[],
    regions: Region[],
    caBundle?: string,
}

export interface MachineImage extends ExpiringVersion {
    name: string,
    cri?: CRIConfig[],
}

export interface MachineType {
    name: string,
    cpu: string,
    gpu: string,
    memory: string,
    storage?: unknown,
    usable?: boolean,
}

export interface VolumeType {
    name: string,
    class: string,
    usable: boolean,
}

export interface Region {
    name: string,
    zone?: {
        name: string,
        unavailableMachineTypes?: string[],
        unavailableVolumeTypes?: string[]
    }[],
    labels: Record<string, string>,
}

export interface CRIConfig {
    name: string,
    containerRuntimes: {
        type: string,
    }[],
}

export interface ExpiringVersion {
    version: string,
    expirationDate: string,
}

export class GardenerInitConfigTask extends Task {

    private virtualClient?: KubeClient;

    constructor(
        private readonly helm: Helm,
        private readonly values: GeneralValues,
        private readonly dryRun: boolean,
    ) {
        super('gardener-init-config');
    }

    public async do() {
        if (!this.dryRun) {
            this.virtualClient = await waitUntilVirtualClusterIsReady(log, this.values);
        }

        this.defaultKubernetesVersion();
        await this.helm.createOrUpdate(
            await(new GardenerInitConfigChart().getRelease(this.values)),
            this.virtualClient?.getKubeConfig()
        );
    }

    /**
     * Defaults the kubernetes version of all cloudprofiles.
     */
    private defaultKubernetesVersion() {
        if (!this.values.gardener.initConfig.defaultKubernetesVersions) {
            return;
        }
        for (const cp of this.values.gardener.initConfig.cloudProfiles) {
            cp.spec.kubernetes.versions = defaultKubernetesVersion(
                cp.spec.kubernetes.versions,
                this.values.gardener.initConfig.defaultKubernetesVersions);
        }
    }
}

class GardenerInitConfigChart extends Chart {

    constructor() {
        super(
            'gardener-init-config',
            new ChartPath('./src/charts/runtime/gardener-init-config'),
            GardenSystemNamespace,
        );
    }

    public async renderValues(values: GeneralValues): Promise<Values> {
        return values.gardener.initConfig;
    }
}

const defaultKubernetesVersion = (v1: ExpiringVersion[], v2: ExpiringVersion[]): ExpiringVersion[] => {
    const v1Set = new Set<string>(v1.map(v => v.version));
    for (const v of v2) {
        if (!v1Set.has(v.version)) {
            v1.push(v);
        }
    }
    return v1;
};
