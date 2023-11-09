import {SemVer} from 'semver';
import {deepCopy} from '@0cfg/utils-common/lib/deepCopy';
import {Flow, Step, VersionedValues} from '../../flow/Flow';
import {VersionedState} from '../../Landscape';
import {createLogger} from '../../log/Logger';
import {Installation as Installation_1_50} from '../v1.50/installation';
import {emptyState, GeneralValues, isStateValues, validateState} from '../v1.46/Values';
import {VirtualClusterChart} from '../v1.46/components/charts/VirtualClusterChart';
import {HelmTask} from '../../flow/HelmTask';

export const VERSION = '1.51';

const log = createLogger('Installation v1.51');

const virtualClusterVersions = [
    'v1.19.16',
    'v1.20.15',
    'v1.21.14',
    'v1.22.12',
];

const targetVirtualClusterVersion = new SemVer('v1.21.14');

export class Installation extends Installation_1_50 {

    private currentApiServerVersion!: SemVer;

    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(inputValues.version);
        } else {
            // with gardener version 1.51 host and virtual cluster running at least 1.20 is required.
            if (!isStateValues(stateValues)) {
                throw validateState(stateValues);
            }
            this.currentApiServerVersion = new SemVer(stateValues.apiserver.version ?? 'v1.18.2');
            if (new SemVer(this.currentApiServerVersion).compareMain(targetVirtualClusterVersion) === -1) {
                stateValues.apiserver.version = targetVirtualClusterVersion.raw;
            }
        }
        await super.install(flow, stateValues, inputValues);
    }

    protected async constructPreVirtualClusterFlow(values: GeneralValues): Promise<Step[]> {
        const steps = await super.constructPreVirtualClusterFlow(values);

        if (this.currentApiServerVersion.compareMain(targetVirtualClusterVersion) === -1) {
            log.info(`Outdated virtual cluster version ${this.currentApiServerVersion}`);
            // add minor update steps for virtual apiserver update
            const latestVirtualClusterStep = steps.pop()!;
            virtualClusterVersions.forEach(v => {
                if (this.currentApiServerVersion.compare(v) >= 0
                    || targetVirtualClusterVersion.compare(v) <= 0) {
                    return;
                }
                log.info(`Adding virtual cluster update to version ${v}`);
                const val = deepCopy(values);
                values.apiserver.version = v;
                steps.push(new HelmTask(new VirtualClusterChart(), val, this.helm));
            });
            steps.push(latestVirtualClusterStep);
        }
        log.info(`virtual cluster is at ${this.currentApiServerVersion.raw}`);
        return steps;
    }
}
