import {Flow, VersionedValues} from '../../flow/Flow';
import {VersionedState} from '../../Landscape';
import {createLogger} from '../../log/Logger';
import {Installation as Installation_1_46} from '../v1.46/installation';
import {emptyState, isStateValues} from '../v1.46/Values';
import {has} from "@0cfg/utils-common/lib/has";
import {MessageDigest} from "../../utils/tls";

export const VERSION = '1.47';

const log = createLogger('');

export class Installation extends Installation_1_46 {

    public async install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void> {
        if (stateValues === null) {
            stateValues = emptyState(inputValues.version);
        } else {
            // with gardener version 1.47 a new go version is used
            // that does not support certificates signed with a sha1 hash.
            // https://github.com/golang/go/issues/41682
            //
            // The current tls certs are deleted and re-genereated with a more secure hash.
            if (!isStateValues(stateValues)) {
                throw new Error('State values invalid');
            }
            if (has(stateValues.apiserver.tls) && stateValues.apiserver.tls.ca.messageDigest !== MessageDigest.SHA384) {
                console.log(stateValues.apiserver.tls.ca.messageDigest);
                delete stateValues.apiserver.tls;
            }
            if (has(stateValues.apiserver.aggregator.tls) && stateValues.apiserver.aggregator.tls.ca.messageDigest !== MessageDigest.SHA384) {
                delete stateValues.apiserver.aggregator.tls;
            }
            if (has(stateValues.etcd.tls) && stateValues.etcd.tls.ca.messageDigest !== MessageDigest.SHA384) {
                delete stateValues.etcd.tls;
            }
            if (has(stateValues.gardener.certs) && stateValues.gardener.certs.ca.messageDigest !== MessageDigest.SHA384) {
                delete stateValues.gardener.certs;
            }
        }

        await super.install(flow, stateValues, inputValues);
    }
}
