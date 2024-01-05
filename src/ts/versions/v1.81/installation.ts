import {Flow, VersionedValues} from '../../flow/Flow';
import {VersionedState} from '../../Landscape';
import {Installation as Installation_1_80} from '../v1.80/installation';
import {emptyState, isStateValues, validateState} from '../v1.46/Values';
import { SemVer } from 'semver';

export const VERSION = '1.81';

const targetVirtualClusterVersion = new SemVer('v1.24.17');

export class Installation extends Installation_1_80 {


    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(inputValues.version);
        } else {
            if (!isStateValues(stateValues)) {
                throw validateState(stateValues);
            }
        }
        // with gardener version 1.81 host and virtual cluster running at least 1.24 is required.
        if (new SemVer(stateValues.apiserver.version).compareMain(targetVirtualClusterVersion) === -1) {
            stateValues.apiserver.version = targetVirtualClusterVersion.raw;
        }
        await super.install(flow, stateValues, inputValues);
        stateValues.version = inputValues.version;
    }

}
