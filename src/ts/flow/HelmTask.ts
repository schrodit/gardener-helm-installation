import { Chart, Helm } from "../utils/Helm";
import { GeneralValues } from "../Values";
import { Task } from "./Flow";


export class HelmTask extends Task {

    constructor(
        private readonly chart: Chart,
        private readonly values: GeneralValues,
        private readonly helm: Helm,
        ) {
        super(chart.realeaseName);
    }

    async do(): Promise<void> {
        await this.helm.createOrUpdate(await this.chart.getRelease(this.values));
    }

}

export class HelmTaskFactory {

    constructor(
        private readonly values: GeneralValues,
        private readonly helm: Helm,
    ) {}


    public createTask(chart: Chart): HelmTask {
        return new HelmTask(chart, this.values, this.helm);
    }
}