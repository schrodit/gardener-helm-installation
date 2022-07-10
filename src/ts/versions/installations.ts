import {satisfies} from 'semver';
import {has} from '@0cfg/utils-common/lib/has';
import {Exception} from '../utils/exceptions';
import {Helm} from '../plugins/Helm';
import {KubeApply} from '../plugins/KubeApply';
import {VersionedState} from '../Landscape';
import {Flow, VersionedValues} from '../flow/Flow';
import {KubeClient} from '../utils/KubeClient';
import {Installation as Installation_1_46} from './v1.46/installation';
import {Installation as Installation_1_47} from './v1.47/installation';

export type InstallationConfig = {
    genDir: string,
    dryRun: boolean,
}

export interface InstallationState {
    store<T extends VersionedState>(s: T): Promise<void>;
}

export interface Installation {
    install(flow: Flow, stateValues: null | VersionedState, inputValues: VersionedValues): Promise<void>;
}

export interface InstallationConstructor {
    new (
        state: InstallationState,
        kubeClient: KubeClient,
        helm: Helm,
        kubeApply: KubeApply,
        config: InstallationConfig,
    ): Installation;
}

const versions: Record<string, InstallationConstructor> = {
    'v1.46.x': Installation_1_46,
    'v1.47.x': Installation_1_47,
};

export class VersionNotFound extends Exception {
    public constructor(version: string) {
        super(`Version ${version} not found`);
    }
}

/**
 * @throws VersionNotFound
 */
export const getInstallation = (version: string): InstallationConstructor => {
    const matchingVersion = Object.keys(versions).find(v => satisfies(version, v));
    if (!has(matchingVersion)) {
        throw new VersionNotFound(version);
    }
    return versions[matchingVersion];
};

/**
 * @throws VersionNotFound
 */
export const convertStateValues = (state: VersionedState, targetVersion: string): VersionedState => {
    const matchingVersion = Object.keys(versions).find(v => satisfies(state.version, v));
    if (!has(matchingVersion)) {
        throw new VersionNotFound(state.version);
    }
    // todo: think of conversion support
    return state;
};
