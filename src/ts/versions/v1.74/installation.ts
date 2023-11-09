import {Flow, VersionedValues} from '../../flow/Flow';
import {VersionedState} from '../../Landscape';
import {Installation as Installation_1_62} from '../v1.62/installation';
import {emptyState, isStateValues, validateState} from '../v1.46/Values';
import { SemVer } from 'semver';

export const VERSION = '1.74';

const targetVirtualClusterVersion = new SemVer('v1.22.17');

export class Installation extends Installation_1_62 {


    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(inputValues.version);
        } else {
            if (!isStateValues(stateValues)) {
                throw validateState(stateValues);
            }
        }
        // with gardener version 1.74 host and virtual cluster running at least 1.22 is required.
        if (new SemVer(stateValues.apiserver.version).compareMain(targetVirtualClusterVersion) === -1) {
            stateValues.apiserver.version = targetVirtualClusterVersion.raw;
        }
        await super.install(flow, stateValues, inputValues);
    }

}
