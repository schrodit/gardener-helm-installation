import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { createLogger } from "../log/Logger";
import { KeyValueState, State } from "../state/State";
import { GeneralValues, StateValues } from "../Values";
import { deepMergeObject } from "./deepMerge";
import { execAsync } from "./execAsync";
import { has } from "./has";

const log = createLogger('Helm');

export type Values = Record<string, any>

export abstract class Chart {

    public constructor(
        public readonly realeaseName: string,
        protected readonly chart: ChartPath | RemoteChart,
        protected readonly namespace?: string,
    ){}

    abstract renderValues(values: GeneralValues): Promise<Values>;

    public async getRelease(values: GeneralValues): Promise<Release> {
        return {
            name: this.realeaseName,
            chart: this.chart,
            namespace: this.namespace,
            values: this.mergeDefaultValues(values, await this.renderValues(values)),
        }
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
    chart: ChartPath | RemoteChart,
    values?: Values,
    namespace?: string,
}

export class ChartPath {
    constructor(public readonly path: string){}
};

export class RemoteChart {
    constructor(
        public readonly name: string,
        public readonly version: string,
        public readonly repository?: string,
    ){}
}

const isChartPath = (obj: unknown): obj is ChartPath => {
    return obj instanceof ChartPath;
}

const isRemoteChart = (obj: unknown): obj is RemoteChart => {
    return obj instanceof RemoteChart;
}

export interface InstalledRelease {
    name: string,
    namespace: string,
    chart: ChartPath | RemoteChart,
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
    }: Release): Promise<void> {
        namespace = namespace ?? this.defaultNamespace;
        const chartRef = this.getChartReference(chart);

        log.info(`Deploying Helm Chart ${name} to ${namespace}`, {name, namespace});

        let cmd = `helm upgrade --install --create-namespace ${name} ${chartRef} --namespace ${namespace} --wait`;
        if (this.dryRun) {
            cmd = `helm template ${name} ${chartRef} --namespace ${namespace}`;
        }

        if(values) {
            cmd+=` -f ${await this.writeValuesFile(name, values)}`;
        }

        this.state.store(name, {
            name,
            namespace,
            chart,
        });
        await execAsync(cmd);
        log.info(`Successfully deployed Helm Chart ${name}`, {name, namespace});
    }

    private getChartReference(ref: ChartPath | RemoteChart): string {
        if (isChartPath(ref)) {
            return ref.path;
        }
        if (isRemoteChart(ref)) {
            let args = `${ref.name} --version ${ref.version}`;
            if (has(ref.repository)) {
                args += ` --repo ${ref.repository}`;
            }
            return args;
        }

        throw new Error(`Unknown chart reference ${ref}`);
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

}