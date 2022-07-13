import {readFile} from 'fs/promises';
import path from 'path';
import {KubeConfig} from '@kubernetes/client-node';
import yaml from 'yaml';
import {has} from '@0cfg/utils-common/lib/has';
import {SemVer} from 'semver';
import {DefaultKubeClient} from './utils/DefaultKubeClient';
import {LocalKeyValueState, LocalState} from './state/LocalState';
import {KubernetesKeyValueState, KubernetesState} from './state/KubernetesState';
import {KeyValueState, State} from './state/State';
import {Helm, Values} from './plugins/Helm';
import {KubeApply} from './plugins/KubeApply';
import {internalFile} from './config';
import {deepMergeObject} from './utils/deepMerge';
import {createLogger} from './log/Logger';
import {convertStateValues, getInstallation} from './versions/installations';
import {Flow} from './flow/Flow';
import {KubeClient} from './utils/KubeClient';
import {DefaultNamespace, emptyState, required, StateValues} from './versions/v1.46/Values';
import {VERSION} from './versions/v1.46/installation';
import {NotFound} from './utils/exceptions';

const defaultValuesFile = './default.yaml';
const extensionsValuesFile = './extensions.yaml';
const genDir = './gen';
const stateFile = './state/state.yaml';
const helmStateFile = './state/helm-state.yaml';
const kubeApplyStateFile = './state/kube-apply-state.yaml';

const log = createLogger('Landscape');

const stateKey = 'state';
const inputValuesKey = 'input';

export interface LandscapeInstallationConfig {
    dryRun?: boolean;
    defaultNamespace?: string;
    valueFiles?: string[];
    values?: VersionedValues;
}

export type VersionedState = Values & {
    version: string;
}

type VersionedValues = Values & {
    version: string;
}

export const deploy = async (config: LandscapeInstallationConfig) => {
    const {kubeClient, state, values, helm, kubeApply} = await setUp(config);
    const currentState = await getCurrentState(state, kubeClient, config.dryRun ?? false);
    log.info(`Current Version ${currentState.version}`);
    log.info(`Install to version ${values.version}`);
    // todo add phase to state.
    if (values.version === currentState.version) {
        log.info(`Nothing todo: version ${values.version} is already installed`);
    }

    const targetState = convertStateValues(currentState, values.version);

    // get Installation for version
    const inst = new (getInstallation(values.version))(
        new InstallationState(state),
        kubeClient,
        helm,
        kubeApply,
        {
            genDir,
            dryRun: config.dryRun ?? false,
        },
    );

    const flow = new Flow('');
    await inst.install(flow, targetState, values);

    log.info(`Successfully installed version ${values.version}`);
};

const setUp = async (config: LandscapeInstallationConfig) => {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const kubeClient = new DefaultKubeClient(kc);

    let state: KeyValueState = new LocalKeyValueState(stateFile);
    if (!config.dryRun) {
        log.info(`Deploying to ${kc.getCurrentCluster()?.server}`);
        state = new KubernetesKeyValueState(
            kubeClient,
            'state-v2',
            DefaultNamespace,
        );
    }

    let helmState: KeyValueState = new LocalKeyValueState(helmStateFile);
    if (!config.dryRun) {
        helmState = new KubernetesKeyValueState(
            kubeClient,
            'helm-state',
            DefaultNamespace,
        );
    }
    let kubeApplyState: KeyValueState = new LocalKeyValueState(kubeApplyStateFile);
    if (!config.dryRun) {
        kubeApplyState = new KubernetesKeyValueState(
            kubeClient,
            'kube-apply-state',
            DefaultNamespace,
        );
    }

    const defaultValues = await readValueFiles(internalFile(defaultValuesFile));
    let values = mergeObjects(
        defaultValues,
        config.values ?? {},
        config.valueFiles ? await readValueFiles(...config.valueFiles) : {},
    ) as VersionedValues;
    required(values, 'version');
    values = mergeObjects(
        await readVersionedDefaults(values.version),
        await readValueFiles(extensionsDefaultsFile(values.version)),
        values,
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

class InstallationState {

    public constructor(
        private readonly state: KeyValueState,
    ) {
    }

    public async store<S extends VersionedState, I extends VersionedValues>(stateValues: S, inputValues: I): Promise<void> {
        await this.state.store(stateKey, stateValues);
        await this.state.store(inputValuesKey, inputValues);
    }
}

const getCurrentState = async (newState: KeyValueState, kubeClient: KubeClient, dryRun: boolean): Promise<VersionedState> => {
    try {
        return await newState.get<VersionedState>(stateKey);
    } catch (e) {
        if (!(e instanceof NotFound)) {
            throw e;
        }
        // fall back to old state file
        log.info('Fall back to old state');
        let oldState: State<StateValues> = new LocalState<StateValues>(stateFile, emptyState(`${VERSION}.0`));
        if (!dryRun) {
            oldState = new KubernetesState<StateValues>(
                kubeClient,
                'state',
                DefaultNamespace,
                emptyState(`${VERSION}.0`),
            );
        }

        const v = (await oldState.get()) as unknown as VersionedState;
        if (!has(v.version)) {
            v.version = v.gardener?.version ?? `${VERSION}.0`;
        }
        return v;
    }
};

const extensionsDefaultsFile = (version: string): string => {
    const v = new SemVer(version);
    return internalFile(path.join('src/ts/versions', `v${v.major}.${v.minor}`, extensionsValuesFile));
};

const readVersionedDefaults = async (version: string): Promise<any> => {
    const v = new SemVer(version);
    const f = internalFile(path.join('src/ts/versions', `v${v.major}.${v.minor}`, defaultValuesFile));
    try {
        return await readFile(f, 'utf-8');
    } catch (e: any) {
        if (e.code !== 'ENOENT') {
            throw e;
        }
        log.info(`No version specific default file found: ${f}`);
        return {};
    }
};

const readValueFiles = async(...valueFiles: string[]): Promise<any> => {
    const allValues = await Promise.all(
        valueFiles.map(path => readValues(path))
    );
    let val = {};
    allValues.forEach( v => {
        val = deepMergeObject(val, v);
    });
    return val;
};

const mergeObjects = (...objects: Values[]): Values => {
    const r = {};
    objects.forEach(o => deepMergeObject(r, o));
    return r;
};

const readValues = async (path: string): Promise<any> => {
    log.info(`Read values from ${path}`);
    return yaml.parse(await readFile(path, 'utf-8'));
};
