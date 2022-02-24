export const has = (...objects: unknown[]): boolean => {
    for (const obj of objects) {
        if(obj === undefined || obj === null) {
            return false;
        }
        if (typeof obj === 'string' && obj === '') {
            return false;
        }
    }
    return true;
}