import { KubeApply, Manifest } from "../utils/KubeApply";
import { Task } from "./Flow";


export class KubeApplyTask extends Task {

    constructor(
        private readonly manifest: Manifest,
        private readonly kubeApply: KubeApply,
        ) {
        super(manifest.name);
    }

    async do(): Promise<void> {
        await this.kubeApply.apply(this.manifest);
    }

}

export class KubeApplyFactory {

    constructor(
        private readonly kubeApply: KubeApply,
    ) {}


    public createTask(manifest: Manifest): KubeApplyTask {
        return new KubeApplyTask(manifest, this.kubeApply);
    }
}
