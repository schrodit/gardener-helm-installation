import {Flow, VersionedValues} from '../../flow/Flow';
import {VersionedState} from '../../Landscape';
import {Installation as Installation_1_51} from '../v1.51/installation';
import {emptyState, isStateValues, validateState} from '../v1.46/Values';
import { Values } from '../../plugins/Helm';

export const VERSION = '1.62';

export class Installation extends Installation_1_51 {

    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(VERSION);
        } else {
            // with gardener version 1.51 host and virtual cluster running at least 1.20 is required.
            if (!isStateValues(stateValues)) {
                throw validateState(stateValues);
            }
            delete stateValues.gardener?.extensions?.['external-dns'];
        }
        await super.install(flow, stateValues, inputValues);
    }

}
