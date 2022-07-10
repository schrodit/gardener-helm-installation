import {readFile} from 'fs/promises';
import {KubeConfig} from '@kubernetes/client-node';
import yaml from 'yaml';
import {has} from '@0cfg/utils-common/lib/has';
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
import {DefaultNamespace, emptyState, StateValues} from './versions/v1.46/Values';
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

class InstallationState {

    public constructor(
        private readonly state: KeyValueState,
    ) {
    }

    public async store<T extends VersionedState>(s: T): Promise<void> {
        await this.state.store(stateKey, s);
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
