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

        await this.helm.createOrUpdate(
            await(new GardenerInitConfigChart().getRelease(this.values)),
            this.virtualClient?.getKubeConfig()
        );
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
