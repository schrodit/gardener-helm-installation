import {Flow} from "../../../lib";
import {HelmTaskFactory} from "../flow/HelmTask";
import {KubeApplyFactory} from "../flow/KubeApplyTask";
import {Exception} from "../utils/exceptions";
import {Installation as Installation_1_46} from "./v1.46/installation";
import {satisfies, SemVer} from "semver";
import {has} from "@0cfg/utils-common/lib/has";
import {Helm} from "../plugins/Helm";
import {KubeApply} from "../plugins/KubeApply";
import {State} from "../state/State";
import {VersionedState} from "../Landscape";
import {StateValues} from "../Values";
import {VersionedValues} from "../flow/Flow";
import {KubeClient} from "../utils/KubeClient";

export type InstallationConfig = {
    genDir: string,
    dryRun: boolean,
}

export interface Installation {
    install(flow: Flow, stateValues: StateValues, inputValues: VersionedValues): Promise<void>;
}

export interface InstallationConstructor {
    new (
        state: State<VersionedState>,
        kubeClient: KubeClient,
        helm: Helm,
        kubeApply: KubeApply,
        config: InstallationConfig,
    ): Installation;
}

const versions: Record<string, InstallationConstructor> = {
    'v1.46.x': Installation_1_46,
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
