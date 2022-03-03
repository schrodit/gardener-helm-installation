import {has} from './has';

/**
 * Merges the source object into the target object.
 * The source object overwrites existing keys.
 *
 * @param target
 * @param source
 * @returns The target instance as given, merged
 */
 export const deepMergeObject = <T, S>(target: T, source: S): T & S => {
    if (!has(source)) {
        return target as T & S;
    }
    if (!has(target)) {
        return source as T & S;
    }
    for (const key in source) {
        if (isObject(source[key])) {
            if (!(key in target)) {
                Object.assign(target, {[key]: {}});
            }
            deepMergeObject((target as any)[key], source[key]);
        } else {
            Object.assign(target, {[key]: source[key]});
        }
    }

    return target as T & S;
};

/**
 * Checks if an item is an object.
 */
export const isObject = (item: any): boolean => {
    return (item && typeof item === 'object' && !Array.isArray(item));
};
