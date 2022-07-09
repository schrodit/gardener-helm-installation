import {KubeConfig} from '@kubernetes/client-node';
import {Chart, Helm} from '../plugins/Helm';
import {GeneralValues} from '../Values';
import {Task, VersionedValues} from './Flow';

export class HelmTask<T extends VersionedValues> extends Task {

    constructor(
        private readonly chart: Chart<T>,
        private readonly values: T,
        private readonly helm: Helm,
        private readonly kubeConfig?: KubeConfig,
        ) {
        super(chart.releaseName);
    }

    public async do(): Promise<void> {
        await this.helm.createOrUpdate(await this.chart.getRelease(this.values), this.kubeConfig);
    }

}

export class HelmTaskFactory<T extends VersionedValues> {

    constructor(
        private readonly values: T,
        private readonly helm: Helm,
    ) {}

    public createTask(chart: Chart<T>, kubeConfig?: KubeConfig): HelmTask<T> {
        return new HelmTask(chart, this.values, this.helm, kubeConfig);
    }
}
