import {KubeConfig} from '@kubernetes/client-node';
import {Chart, Helm} from '../plugins/Helm';
import {GeneralValues} from '../Values';
import {Task} from './Flow';

export class HelmTask extends Task {

    constructor(
        private readonly chart: Chart,
        private readonly values: GeneralValues,
        private readonly helm: Helm,
        private readonly kubeConfig?: KubeConfig,
        ) {
        super(chart.realeaseName);
    }

    public async do(): Promise<void> {
        await this.helm.createOrUpdate(await this.chart.getRelease(this.values), this.kubeConfig);
    }

}

export class HelmTaskFactory {

    constructor(
        private readonly values: GeneralValues,
        private readonly helm: Helm,
    ) {}

    public createTask(chart: Chart, kubeConfig?: KubeConfig): HelmTask {
        return new HelmTask(chart, this.values, this.helm, kubeConfig);
    }
}
