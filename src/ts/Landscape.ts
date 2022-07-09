import {DefaultNamespace, emptyStateFile, InputValues, StateValues} from "./Values";
import {KubeConfig} from "@kubernetes/client-node";
import {DefaultKubeClient} from "./utils/DefaultKubeClient";
import {LocalKeyValueState, LocalState} from "./state/LocalState";
import {KubernetesKeyValueState, KubernetesState} from "./state/KubernetesState";
import {KeyValueState, State} from "./state/State";
import {Helm, InstalledRelease, Values} from "./plugins/Helm";
import {KubeApply, ManagedResources} from "./plugins/KubeApply";
import {internalFile} from "./config";
import {deepMergeObject} from "./utils/deepMerge";
import {createLogger} from "./log/Logger";
import yaml from "yaml";
import {readFile} from "fs/promises";
import {stat} from "fs";
import {getInstallation} from "./versions/installations";

const defaultValuesFile = './default.yaml';
const extensionsValuesFile = './extensions.yaml';
const genDir = './gen';
const stateFile = './state/state.yaml';
const helmStateFile = './state/helm-state.yaml';
const kubeApplyStateFile = './state/kube-apply-state.yaml';

const log = createLogger('Landscape');

export interface LandscapeInstallationConfig {
    dryRun?: boolean;
    defaultNamespace?: string;
    valueFiles?: string[];
    values?: InputValues;
}

export type VersionedState = {
    version: string;
}

export type VersionedValues = Values & {
    version: string;
}

export const deploy = async (config: LandscapeInstallationConfig) => {
    const {kubeClient, state, values} = await setUp(config);
    const currentState = await state.get();
    // todo add phase to state.
    if (values.version === currentState.version) {
        log.info(`Nothing todo: version ${values.version} is already installed`);
    }
    // get Installation for version
    const inst = new (getInstallation(values.version))();



};

const setUp = async (config: LandscapeInstallationConfig) => {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const kubeClient = new DefaultKubeClient(kc);

    let state: State<VersionedState> = new LocalState<VersionedState>(stateFile, emptyStateFile);
    if (!config.dryRun) {
        log.info(`Deploying to ${kc.getCurrentCluster()?.server}`);
        state = new KubernetesState<VersionedState>(
            kubeClient,
            'state',
            DefaultNamespace,
            emptyStateFile,
        );
    }

    let helmState: KeyValueState<InstalledRelease> = new LocalKeyValueState<InstalledRelease>(helmStateFile);
    if (!config.dryRun) {
        helmState = new KubernetesKeyValueState<InstalledRelease>(
            kubeClient,
            'helm-state',
            DefaultNamespace,
        );
    }
    let kubeApplyState: KeyValueState<ManagedResources[]> = new LocalKeyValueState<ManagedResources[]>(kubeApplyStateFile);
    if (!config.dryRun) {
        kubeApplyState = new KubernetesKeyValueState<ManagedResources[]>(
            kubeClient,
            'kube-apply-state',
            DefaultNamespace,
        );
    }

    const valueFiles = [
        internalFile(defaultValuesFile),
        internalFile(extensionsValuesFile),
    ].concat(config.valueFiles ?? []);
    const values = deepMergeObject(
        config.values ?? {},
        await readValueFiles(valueFiles),
    ) as VersionedValues;

    return {
        kubeClient,
        state,
        helm: new Helm(
            genDir,
            helmState,
            config.dryRun ?? false,
            config.defaultNamespace ?? DefaultNamespace,
        ),
        kubeApply: new KubeApply(
            kubeClient,
            kubeApplyState,
            config.dryRun ?? false,
            config.defaultNamespace ?? DefaultNamespace,
        ),
        helmState,
        kubeApplyState,
        values,
    };
};

const readValueFiles = async(valueFiles: string[]): Promise<any> => {
    const allValues = await Promise.all(
        valueFiles.map(path => readValues(path))
    );
    let val = {};
    allValues.forEach( v => {
        val = deepMergeObject(val, v);
    });
    return val;
};

const readValues = async (path: string): Promise<any> => {
    log.info(`Read values from ${path}`);
    return yaml.parse(await readFile(path, 'utf-8'));
};
