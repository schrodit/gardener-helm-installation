import { mkdir, access } from "fs/promises"

/**
 * Creates a directory if it does not exist
 */
export const createDir = async (dirName: string): Promise<void> => {
    try {
        await access(dirName);
    } catch (error) {
        await mkdir(dirName);
    }
}