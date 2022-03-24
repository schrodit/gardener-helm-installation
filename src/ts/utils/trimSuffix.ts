
export const trimSuffix = (s: string, prefix: string): string => {
    if (s.endsWith(prefix)) {
        return s.slice(0, s.length - prefix.length);
    }
    return s;
};
