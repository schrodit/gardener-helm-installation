import {Values} from '../plugins/Helm';
import {GardenerV1Beta1APIVersion} from './gardener';
import {KubernetesObject} from '@kubernetes/client-node';

export const ControllerDeploymentKind = 'ControllerDeployment';

export interface V1Beta1ControllerDeployment extends KubernetesObject {
    apiVersion: typeof GardenerV1Beta1APIVersion,
    kind: typeof ControllerDeploymentKind,
    type: string,
    providerConfig: Values,
}

export const isV1Beta1DeploymentRegistration = (obj: KubernetesObject): obj is V1Beta1ControllerDeployment => {
    return obj.apiVersion === GardenerV1Beta1APIVersion && obj.kind === ControllerDeploymentKind;
};
