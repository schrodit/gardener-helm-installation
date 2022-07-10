import {existsSync} from 'fs';
import path from 'path';

let root: string | undefined;

export const rootDir = (): string => {
    if (root) {
        return root;
    }
    const srcDir = __dirname;

    // repo root if the file is run from the compiled resources
    // or within the node module
    root = path.join(srcDir, '../');
    if (isRoot(root)) {
        return root;
    }

    // repo root if the file is run with ts-node
    root = path.join(srcDir, '../../');
    if (isRoot(root)) {
        return root;
    }

    throw new Error('Repo root cannot be determined');
};

/**
 * Returns the real path to an internal file.
 */
export const internalFile = (filepath: string): string => {
    return path.join(rootDir(), filepath);
};

/**
 * Returns the path to a host chart.
 */
export const hostChartPath = (chartName: string): string => {
    return internalFile(path.join('src/charts', chartName));
};

/**
 * Checks if the given directoy is the root directory by checking the package.json exists.
 */
const isRoot = (dir: string): boolean => {
    return existsSync(path.join(dir, 'package.json'));
};
