import {KubernetesObject} from '@kubernetes/client-node';
import {GardenerV1Beta1APIVersion} from './gardener';

export const ControllerRegistrationKind = 'ControllerRegistration';

export interface V1Beta1ControllerRegistration extends KubernetesObject {
    apiVersion: typeof GardenerV1Beta1APIVersion,
    kind: typeof ControllerRegistrationKind,
    spec: {
        deployment: {
            deploymentRefs: string[],
        },
        resources: V1Beta1ControllerRegistrationResource[],
    },
}

export interface V1Beta1ControllerRegistrationResource {
    kind: string,
    type: string,
    globallyEnabled?: boolean,
}

export const isV1Beta1ControllerRegistration = (obj: KubernetesObject): obj is V1Beta1ControllerRegistration => {
    return obj.apiVersion === GardenerV1Beta1APIVersion && obj.kind === ControllerRegistrationKind;
};
