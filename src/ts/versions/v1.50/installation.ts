import {has} from '@0cfg/utils-common/lib/has';
import {Flow, VersionedValues} from '../../flow/Flow';
import {VersionedState} from '../../Landscape';
import {createLogger} from '../../log/Logger';
import {Installation as Installation_1_47} from '../v1.46/installation';
import {emptyState, GeneralValues, isStateValues} from '../v1.46/Values';

export const VERSION = '1.50';

const log = createLogger('');

export class Installation extends Installation_1_47 {

    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(inputValues.version);
        } else {
            // with gardener version 1.50 the UseDNSRecords feature gate got dropped,
            // so we need to remove it from the state.
            if (!isStateValues(stateValues)) {
                throw new Error('State values invalid');
            }
            const v = stateValues as GeneralValues;
            if (has(v.gardener?.featureGates?.['UseDNSRecords'])) {
                delete v.gardener?.featureGates?.['UseDNSRecords'];
            }
        }

        await super.install(flow, stateValues, inputValues);
    }
}
