import {access, mkdir, writeFile} from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {KubeConfig} from '@kubernetes/client-node';
import {createLogger} from '../log/Logger';
import {KeyValueState} from '../state/State';
import {GeneralValues} from '../Values';
import {deepMergeObject} from '../utils/deepMerge';
import {execAsync} from '../utils/execAsync';
import {has} from '../utils/has';
import {DownloadManager} from '../utils/DownloadManager';

const log = createLogger('Helm');

export type Values = Record<string, any>

export abstract class Chart {

    public constructor(
        public readonly realeaseName: string,
        protected readonly chart: ChartContent,
        protected readonly namespace?: string,
    ) {}

    public abstract renderValues(values: GeneralValues): Promise<Values>;

    public async getRelease(values: GeneralValues): Promise<Release> {
        return {
            name: this.realeaseName,
            chart: this.chart,
            namespace: this.namespace,
            values: this.mergeDefaultValues(values, await this.renderValues(values)),
        };
    }

    /**
     * Make it possible to overwrite every value.
     */
    private mergeDefaultValues(generalValues: Values, releaseValues: Values): Values {
        if (!has(generalValues[this.realeaseName])) {
            return releaseValues;
        }
        return deepMergeObject(releaseValues, generalValues[this.realeaseName]);
    }
}

export interface Release {
    name: string,
    chart: ChartContent,
    values?: Values,
    namespace?: string,
}

export interface ChartContent {
    getHelmArgs(): Promise<string>
}

export interface InjectGenDir {
    injectGenDir(dir: string): void;
}

export class ChartPath implements ChartContent {
    constructor(public readonly path: string) {}

    public async getHelmArgs(): Promise<string> {
        return this.path;
    }
}

export class RemoteChart {
    constructor(
        public readonly name: string,
        public readonly version: string,
        public readonly repository?: string,
    ) {}

    public async getHelmArgs(): Promise<string> {
        let args = `${this.name} --version ${this.version}`;
        if (has(this.repository)) {
            args += ` --repo ${this.repository}`;
        }
        return args;
    }
}

export class RemoteChartFromZip implements ChartContent, InjectGenDir {
    private genDir?: string;

    constructor(
        public readonly url: string,
        public readonly path: string,
    ) {}

    public injectGenDir(dir: string): void {
        this.genDir = dir;
    }

    public async getHelmArgs(): Promise<string> {
        if (!has(this.genDir)) {
            throw new Error('Gen Directory not set');
        }
        const dm = new DownloadManager(this.genDir!);
        const extractedDir = await dm.downloadAndExtractZip(this.url);

        return path.resolve(path.join(extractedDir, this.path));
    }
}

const implementsInjectGenDir = (obj: unknown): obj is InjectGenDir => {
    return typeof obj === 'object'
        && typeof (obj as any).injectGenDir === 'function';
};

export interface InstalledRelease {
    name: string,
    namespace: string,
    chart: ChartContent,
}

/**
 * Wrapper for helm commands
 */
export class Helm {
    constructor(
        private readonly genDir: string,
        private readonly state: KeyValueState<InstalledRelease>,
        private readonly dryRun: boolean,
        private readonly defaultNamespace: string,
    ) {
    }

    public async createOrUpdate({
        name,
        chart,
        values,
        namespace,
    }: Release, kubeConfig?: KubeConfig): Promise<void> {
        namespace = namespace ?? this.defaultNamespace;

        if (implementsInjectGenDir(chart)) {
            chart.injectGenDir(this.genDir);
        }

        const chartArgs = await chart.getHelmArgs();

        let additionalArgs = '';
        if (has(kubeConfig)) {
            additionalArgs += `--kubeconfig=${await this.writeKubeconfigFile(kubeConfig!)}`;
        }

        log.info(`Deploying Helm Chart ${name} to ${namespace}`, {name, namespace});

        let cmd = `helm upgrade --install --create-namespace ${name} ${chartArgs} --namespace ${namespace} --wait ${additionalArgs}`;
        if (this.dryRun) {
            cmd = `helm template ${name} ${chartArgs} --namespace ${namespace} ${additionalArgs}`;
        }

        if (values) {
            cmd+=` -f ${await this.writeValuesFile(name, values)}`;
        }

        await this.state.store(name, {
            name,
            namespace,
            chart,
        });
        await execAsync(cmd);
        log.info(`Successfully deployed Helm Chart ${name}`, {name, namespace});
    }

    /**
     * Writes values to the gen dir and returns the string to the written file.
     */
    private async writeValuesFile(releaseName: string, values: Values): Promise<string> {
        const releaseDir = path.join(this.genDir, releaseName);
        const valuesFilePath = path.join(releaseDir, 'values.yaml');
        try {
            await access(releaseDir);
        } catch (error) {
            await mkdir(releaseDir);
        }
        await writeFile(valuesFilePath, JSON.stringify(values, null, '  '), 'utf-8');
        return valuesFilePath;
    }

    private async writeKubeconfigFile(kubeConfig: KubeConfig): Promise<string> {
        const kcFilename = `${this.hash(kubeConfig.exportConfig())}.kubeconfig`;
        const kcFilepath = path.join(this.genDir, kcFilename);
        try {
            await access(kcFilepath);
            return kcFilepath;
        } catch (error) {
        }

        const raw = kubeConfig.exportConfig();
        await writeFile(kcFilepath, raw, 'utf-8');
        return kcFilepath;
    }

    private hash(name: string): string {
        const shasum = crypto.createHash('sha1');
        shasum.update(name);
        return shasum.digest('hex');
    }

}
