import path from 'path';
import {access, unlink} from 'fs/promises';
import crypto from 'crypto';
import {has} from './has';
import {createDir} from './createDir';
import {downloadFile} from './downloadFile';
import * as extract from 'extract-zip';

/**
 * Manages downloaded artifacts.
 */
export class DownloadManager {

    constructor(private readonly genDir: string) {
    }

    public async downloadAndExtractZip(url: string): Promise<string> {
        const extractedDir = path.join(await this.getCacheDir(), `${this.fileName(url)}-extr`);
        try {
            await access(extractedDir);
            return extractedDir;
        } catch (error) {
        }

        const zipFile = await this.download(url);
        await extract.default(zipFile, {
            dir: path.resolve(extractedDir),
        });
        await unlink(zipFile);
        return extractedDir;
    }

    /**
     * Downloads an artifact and returns the path to the downloaded location.
     */
    public async download(url: string): Promise<string> {
        const output = path.join(await this.getCacheDir(), this.fileName(url));

        try {
            await access(output);
        } catch (error) {
            await downloadFile(url, output);
        }
        return output;
    }

    private async getCacheDir(): Promise<string> {
        if (!has(this.genDir)) {
            throw new Error('Gen Directory not set');
        }
        const cacheDir = path.join(this.genDir!, 'cache');
        await createDir(cacheDir);
        return cacheDir;
    }

    private fileName(url: string): string {
        const shasum = crypto.createHash('sha1');
        shasum.update(url);
        return shasum.digest('hex');
    }
}
