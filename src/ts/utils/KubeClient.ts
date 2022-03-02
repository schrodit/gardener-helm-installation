import * as http from 'http';
import {
    KubeConfig,
    KubernetesListObject,
    KubernetesObject,
    RequestResult,
    V1DeleteOptions,
    V1Status,
} from '@kubernetes/client-node';

/**
 * Describes the type of an watch event.
 * Object is:
 * - If Type is Added or Modified: the new state of the object.
 * - If Type is Deleted: the state of the object immediately before deletion.
 * - If Type is Bookmark: the object (instance of a type being watched) where
 *   only ResourceVersion field is set. On successful restart of watch from a
 *   bookmark resourceVersion, client is guaranteed to not get repeat event
 *   nor miss any events.
 * - If Type is Error: *api.Status is recommended; other types may make sense
 *   depending on context.
 */
export enum KubernetesEventType {
    ADDED = 'ADDED',
    MODIFIED = 'MODIFIED',
    DELETED = 'DELETED',
    BOOKMARK = 'BOOKMARK',
    ERROR = 'ERROR',
}

export interface WatchObject {
    type: KubernetesEventType,
    object: any,
}

/**
 * Describes a Kubernetes client that implements the KubernetesObjectApi and Kubernetes Watch api.
 */
export interface KubeClient {
    /**
     * Create any Kubernetes resource.
     * @param spec Kubernetes resource spec.
     * @param pretty If \&#39;true\&#39;, then the output is pretty printed.
     * @param dryRun When present, indicates that modifications should not be persisted. An invalid or unrecognized
     *        dryRun directive will result in an error response and no further processing of the request. Valid values
     *        are: - All: all dry run stages will be processed
     * @param fieldManager fieldManager is a name associated with the actor or entity that is making these changes. The
     *        value must be less than or 128 characters long, and only contain printable characters, as defined by
     *        https://golang.org/pkg/unicode/#IsPrint.
     * @param options Optional headers to use in the request.
     * @return Promise containing the request response and [[KubernetesObject]].
     */
    create(
        spec: KubernetesObject,
        pretty?: string,
        dryRun?: string,
        fieldManager?: string,
        options?: { headers: { [name: string]: string } },
    ): Promise<{ body: KubernetesObject; response: http.IncomingMessage }>

    /**
     * Replace any Kubernetes resource.
     * @param spec Kubernetes resource spec
     * @param pretty If \&#39;true\&#39;, then the output is pretty printed.
     * @param dryRun When present, indicates that modifications should not be persisted. An invalid or unrecognized
     *        dryRun directive will result in an error response and no further processing of the request. Valid values
     *        are: - All: all dry run stages will be processed
     * @param fieldManager fieldManager is a name associated with the actor or entity that is making these changes. The
     *        value must be less than or 128 characters long, and only contain printable characters, as defined by
     *        https://golang.org/pkg/unicode/#IsPrint.
     * @param options Optional headers to use in the request.
     * @return Promise containing the request response and [[KubernetesObject]].
     */
    replace(
        spec: KubernetesObject,
        pretty?: string,
        dryRun?: string,
        fieldManager?: string,
        options?: { headers: { [name: string]: string } },
    ): Promise<{ body: KubernetesObject; response: http.IncomingMessage }>

    /**
     * Delete any Kubernetes resource.
     * @param spec Kubernetes resource spec
     * @param pretty If \&#39;true\&#39;, then the output is pretty printed.
     * @param dryRun When present, indicates that modifications should not be persisted. An invalid or unrecognized
     *        dryRun directive will result in an error response and no further processing of the request. Valid values
     *        are: - All: all dry run stages will be processed
     * @param gracePeriodSeconds The duration in seconds before the object should be deleted. Value must be non-negative
     *        integer. The value zero indicates delete immediately. If this value is nil, the default grace period for
     *        the specified type will be used. Defaults to a per object value if not specified. zero means delete
     *        immediately.
     * @param orphanDependents Deprecated: please use the PropagationPolicy, this field will be deprecated in
     *        1.7. Should the dependent objects be orphaned. If true/false, the \&quot;orphan\&quot; finalizer will be
     *        added to/removed from the object\&#39;s finalizers list. Either this field or PropagationPolicy may be
     *        set, but not both.
     * @param propagationPolicy Whether and how garbage collection will be performed. Either this field or
     *        OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in
     *        the metadata.finalizers and the resource-specific default policy. Acceptable values are:
     *        \&#39;Orphan\&#39; - orphan the dependents; \&#39;Background\&#39; - allow the garbage collector to delete
     *        the dependents in the background; \&#39;Foreground\&#39; - a cascading policy that deletes all dependents
     *        in the foreground.
     * @param body See [[V1DeleteOptions]].
     * @param options Optional headers to use in the request.
     * @return Promise containing the request response and a Kubernetes [[V1Status]].
     */
    delete(
        spec: KubernetesObject,
        pretty?: string,
        dryRun?: string,
        gracePeriodSeconds?: number,
        orphanDependents?: boolean,
        propagationPolicy?: string,
        body?: V1DeleteOptions,
        options?: { headers: { [name: string]: string } },
    ): Promise<{ body: V1Status; response: http.IncomingMessage }>

    /**
     * Read any Kubernetes resource.
     * @param spec Kubernetes resource spec
     * @param pretty If \&#39;true\&#39;, then the output is pretty printed.
     * @param exact Should the export be exact.  Exact export maintains cluster-specific fields like
     *        \&#39;Namespace\&#39;. Deprecated. Planned for removal in 1.18.
     * @param exportt Should this value be exported.  Export strips fields that a user can not
     *        specify. Deprecated. Planned for removal in 1.18.
     * @param options Optional headers to use in the request.
     * @return Promise containing the request response and [[KubernetesObject]].
     */
    read(
        spec: KubernetesObject,
        pretty?: string,
        exact?: boolean,
        exportt?: boolean,
        options?: { headers: { [name: string]: string } },
    ): Promise<{ body: KubernetesObject; response: http.IncomingMessage }>

    /**
     * List any Kubernetes resources.
     * @param apiVersion api group and version of the form <apiGroup>/<version>
     * @param kind Kubernetes resource kind
     * @param namespace list resources in this namespace
     * @param pretty If \&#39;true\&#39;, then the output is pretty printed.
     * @param exact Should the export be exact.  Exact export maintains cluster-specific fields like
     *        \&#39;Namespace\&#39;. Deprecated. Planned for removal in 1.18.
     * @param exportt Should this value be exported.  Export strips fields that a user can not
     *        specify. Deprecated. Planned for removal in 1.18.
     * @param fieldSelector A selector to restrict the list of returned objects by their fields. Defaults to everything.
     * @param labelSelector A selector to restrict the list of returned objects by their labels. Defaults to everything.
     * @param limit Number of returned resources.
     * @param options Optional headers to use in the request.
     * @return Promise containing the request response and [[KubernetesListObject<KubernetesObject>]].
     */
    list(
        apiVersion: string,
        kind: string,
        namespace?: string,
        pretty?: string,
        exact?: boolean,
        exportt?: boolean,
        fieldSelector?: string,
        labelSelector?: string,
        limit?: number,
        continueToken?: string,
        options?: { headers: { [name: string]: string } },
    ): Promise<{ body: KubernetesListObject<KubernetesObject>; response: http.IncomingMessage }>

    /**
     * Watch the resource and call provided callback with parsed json object
     * upon event received over the watcher connection.
     */
    watch(
        path: string,
        queryParams: any,
        callback: (type: KubernetesEventType, apiObj: any, watchObj?: WatchObject) => void,
        done: (err: any) => void,
    ): Promise<RequestResult>

    /**
     * Returns the currently used kubeconfig
     */
    getKubeConfig(): KubeConfig

    /**
     * Returns the api path for a kubernetes resource as it is needed by the watch method.
     */
    getAPIResourcePath(apiVersion: string, kind: string, namespace?: string): Promise<string>
}

