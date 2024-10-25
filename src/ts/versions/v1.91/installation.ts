import {Flow, VersionedValues} from '../../flow/Flow';
import {VersionedState} from '../../Landscape';
import {Installation as Installation_1_81} from '../v1.81/installation';
import {emptyState, isStateValues, validateState} from '../v1.46/Values';
import { SemVer } from 'semver';

export const VERSION = '1.81';

const targetVirtualClusterVersion = new SemVer('v1.25.16');

export class Installation extends Installation_1_81 {


    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(inputValues.version);
        } else {
            if (!isStateValues(stateValues)) {
                throw validateState(stateValues);
            }
        }
        // with gardener version 1.81 host and virtual cluster running at least 1.25 is required.
        if (new SemVer(stateValues.apiserver.version).compareMain(targetVirtualClusterVersion) === -1) {
            stateValues.apiserver.version = targetVirtualClusterVersion.raw;
        }
        await super.install(flow, stateValues, inputValues);
        stateValues.version = inputValues.version;
    }

}
