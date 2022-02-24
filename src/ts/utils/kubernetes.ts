import { has } from "@0cfg/utils-common/lib/has";
import { KubernetesObject } from "@kubernetes/client-node";
import { KubeClient } from "./KubeClient";


/**
 * Returns a list of all available hosts of a namespaced service.
 * @param svcName 
 */
export const serviceHosts = (svcName: string, ns: string): string[] => {
    const suffix = ['svc', 'cluster', 'local'];
    suffix.unshift(ns)

    const hosts = [svcName];
    let prev = svcName;
    for (const p of suffix) {
        prev = [prev, p].join('.');
        hosts.push(prev)
    }
    return hosts;
}


/**
 * Creates or updates the given object in the Kubernetes cluster.
 * The given object is updated with the newly created or read values.
 *
 * Optionally a mutate function can be defined that is called before the object is created or updated.
 * This function is useful if a object already exists and has been modified by other controllers.
 * Otherwise the obj could not be updated with a "AlreadyModified" error.
 * @param mutate fFunction that mutates {@param object}
 */
 export const createOrUpdate = async (client: KubeClient,
    object: KubernetesObject,
    mutate?: () => Promise<void>): Promise<void> => {

    try {
        const readResponse = await client.read({
            apiVersion: object.apiVersion,
            kind: object.kind,
            metadata: object.metadata,
        });
        // If the object can be read it already exists and it must be updated
        if (mutate) {
            // The object has to be updated to populate the Kubernetes resource version.
            Object.assign(object, readResponse.body);
            await mutate();
        }
        const replaceResponse = await client.replace(object);
        Object.assign(object, replaceResponse.body);
        return;
    } catch (err) {
        if (!isNotFoundError(err)) {
            throw enrichKubernetesError(object, err);
        }
    }
    // Object does not exist, so we have to create it.
    if (mutate) {
        await mutate();
    }
    try {
        const createResponse = await client.create(object);
        Object.assign(object, createResponse.body);
    } catch (err) {
        throw enrichKubernetesError(object, err);
    }
};

export interface KubernetesError {
    body: {
        code: number,
        reason: string,
        message: string,
    },
}

const isKubernetesError = (object: unknown): object is KubernetesError => {
    const body = (object as KubernetesError).body;
    return has(body) && [body.code, body.reason, body.message].every(has);
};

/**
 * Checks if the error is a resource not found error from Kubernetes.
 */
export const isNotFoundError = (err: unknown): boolean => {
    return isKubernetesError(err) && err.body.code === 404;
};

export class NotFoundError extends Error {
    public constructor(resource: KubernetesObject) {
        const resourceInfo = `[${resource.apiVersion}:${resource.kind} `
            + `${resource.metadata?.namespace}/${resource.metadata?.name}]`;
        super(`Resource ${resourceInfo} not found`);
    }
}

/**
 * Parses an error that was thrown by the Kubernetes client and
 * adds additional error information like the accessed resource.
 */
export const enrichKubernetesError = (resource: KubernetesObject, err: unknown): Error => {
    const resourceInfo = `[${resource.apiVersion}:${resource.kind} `
                          + `${resource.metadata?.namespace}/${resource.metadata?.name}]`;
    if (isKubernetesError(err)) {
        if (err.body.code === 404) {
            return new NotFoundError(resource);
        }
        return new Error(`Reason: ${err.body.reason}  Message: ${err.body.message} - ${resourceInfo}`);
    }
    if (err instanceof Error) {
        return new Error(`${err.message} - ${resourceInfo}`);
    }
    return new Error(`${JSON.stringify(err)} - ${resourceInfo}`);
};


/**
 * Encodes a map of key, value pairs to JSON.stringified base64 encoded values.
 */
export const base64EncodeMap = (data: Record<string, any>, 
    options: {jsonIgnoreString: boolean} = {
        jsonIgnoreString: false,
    }): Record<string, string> => {
    const raw: Record<string, string> = {};
    for (const key in data) {
        const d = data[key];
        if (options.jsonIgnoreString && typeof d === 'string') {
            raw[key] = Buffer.from(d, 'utf-8').toString('base64');
            continue;
        }

        raw[key] = Buffer.from(JSON.stringify(d), 'utf-8').toString('base64');
    }
    return raw;
}
