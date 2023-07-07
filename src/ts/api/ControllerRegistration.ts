import {KubernetesObject} from '@kubernetes/client-node';
import {GardenerV1Beta1APIVersion} from './gardener';

export const ControllerRegistrationKind = 'ControllerRegistration';

export interface V1Beta1ControllerRegistration extends KubernetesObject {
    apiVersion: typeof GardenerV1Beta1APIVersion,
    kind: typeof ControllerRegistrationKind,
    spec: {
        deployment: {
            deploymentRefs: string[],
            seedSelector?: LabelSelector,
        },
        resources: V1Beta1ControllerRegistrationResource[],
    },
}

export type LabelSelector = {
    matchExpressions: LabelSelectorExpression[],
}

export type LabelSelectorExpression = {
    key: string,
    operator: string,
    values: string[],
}

export interface V1Beta1ControllerRegistrationResource {
    kind: string,
    type: string,
    globallyEnabled?: boolean,
    primary?: boolean,
}

export const isV1Beta1ControllerRegistration = (obj: KubernetesObject): obj is V1Beta1ControllerRegistration => {
    return obj.apiVersion === GardenerV1Beta1APIVersion && obj.kind === ControllerRegistrationKind;
};
