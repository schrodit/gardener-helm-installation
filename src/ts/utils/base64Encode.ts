
/**
 * Base64 encodes a string
 */
export const base64Encode = (s: string): string => {
    return Buffer.from(s, 'utf-8').toString('base64');
};
