

/**
 * Decodes a base64 encoded string
 */
export const base64Decode = (s: string): string => {
    return Buffer.from(s, 'base64').toString('utf-8');
}