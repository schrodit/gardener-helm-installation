import {KubeApply, Manifest} from '../plugins/KubeApply';
import {KubeClient} from '../utils/KubeClient';
import {Task} from './Flow';

export class KubeApplyTask extends Task {

    constructor(
        private readonly manifest: Manifest,
        private readonly kubeApply: KubeApply,
        private readonly kubeClient?: KubeClient,
        ) {
        super(manifest.name);
    }

    public async do(): Promise<void> {
        await this.kubeApply.apply(this.manifest, this.kubeClient);
    }

}

export class KubeApplyFactory {

    constructor(
        private readonly kubeApply: KubeApply,
    ) {}

    public createTask(manifest: Manifest, kubeClient?: KubeClient): KubeApplyTask {
        return new KubeApplyTask(manifest, this.kubeApply, kubeClient);
    }
}
