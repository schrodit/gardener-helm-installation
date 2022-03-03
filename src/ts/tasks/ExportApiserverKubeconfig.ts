import {writeFile} from 'fs/promises';
import path from 'path';
import {Task} from '../flow/Flow';
import {base64Encode} from '../utils/base64Encode';
import {KubeClient} from '../utils/KubeClient';
import {GardenerNamespace, GeneralValues} from '../Values';
import {createSecret} from '../state/KubernetesState';
import {retryWithBackoff} from '../utils/exponentialBackoffRetry';
import {createLogger} from '../log/Logger';
import {createOrUpdate, enrichKubernetesError} from '../utils/kubernetes';
import {getVirtualClusterAdminKubeconfig} from '../components/VirtualCluster';

const log = createLogger('ExportVirtualClusterAdminKubeconfig');

export class ExportVirtualClusterAdminKubeconfig extends Task {
    constructor(
        private readonly kubeClient: KubeClient,
        private readonly values: GeneralValues,
        private readonly genDir: string,
        private readonly dryRun: boolean,
    ) {
        super('ExportVirtualClusterAdminKubeconfig');
    }

    public async do(): Promise<void> {
        const kc = getVirtualClusterAdminKubeconfig(this.values);
        const rawKc = kc.exportConfig();

        await writeFile(path.join(this.genDir, 'kubeconfig'), rawKc, 'utf-8');

        if (this.dryRun) {
            return;
        }

        const secret = createSecret(GardenerNamespace, 'admin-kubeconfig');
        await retryWithBackoff(async (): Promise<boolean> => {
            try {
                await createOrUpdate(this.kubeClient, secret, async () => {
                    secret.data = {
                        kubeconfig: base64Encode(rawKc),
                    };
                });
                return true;
            } catch (error) {
                log.error(enrichKubernetesError(secret, error));
                return false;
            }
        });
        log.info(`Successfully exported admin kubeconfig to secret ${GardenerNamespace}/admin-kubeconfig`);
    }
}
