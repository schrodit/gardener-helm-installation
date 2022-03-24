import semver from 'semver';
import {SemVer} from 'semver';
import {Octokit} from '@octokit/rest';
import {RequestError} from '@octokit/request-error';
import {createLogger} from '../log';

const log = createLogger('Versions');

class GitHubReleases {
    private static instance: GitHubReleases;

    public static getInstance(): GitHubReleases {
        if (!GitHubReleases.instance) {
            GitHubReleases.instance = new GitHubReleases();
        }
        return GitHubReleases.instance;
    }

    /**
     * Caches org/repo and their versions
     * @private
     */
    private readonly cache: Record<string, SemVer[]> = {};

    public async getVersions(org: string, repository: string): Promise<SemVer[]> {
        const cacheKey = this.cacheKey(org, repository);
        if (!this.cache[cacheKey]) {
            await this.updateCache(org, repository);
        }
        return this.cache[cacheKey];
    }

    private async updateCache(org: string, repository: string) {
        const cacheKey = this.cacheKey(org, repository);
        try {
            this.cache[cacheKey] = semver.rsort(await this.fetch(org, repository));
        } catch (error) {
            if (error instanceof RequestError) {
                if (error.status === 403) {
                    log.info(`Unable to fetch newest versions for ${org}/${repository}. ${error.message}`);
                    this.cache[cacheKey] = [];
                    return;
                }
            }
            throw error;
        }
    }

    private cacheKey(org: string, repository: string): string {
        return `${org}/${repository}`;
    }

    private async fetch(org: string, repository: string, page: number = 1): Promise<SemVer[]> {
        const octokit = new Octokit();

        const releases = (await octokit.rest.repos.listReleases({
            owner: org,
            repo: repository,
            page,
        })).data;

        if (releases.length === 0) {
            return [];
        }

        return releases.map(r => new SemVer(r.tag_name)).concat(await this.fetch(org, repository, page++));
    }
}

/**
 * Returns a sorted list of available versions from github releases
 * @param org
 * @param repository
 */
export const getVersionsFromGitHubReleases = (org: string, repository: string): Promise<SemVer[]> => {
    return GitHubReleases.getInstance().getVersions(org, repository);
};

export const getLatestVersionForMinor = (version: SemVer, versions: SemVer[]): SemVer | null => {
    return semver.maxSatisfying(versions, `${version.major}.${version.minor}.x`);
};

export class Versions {

    private readonly versions = new Map<number, Map<number, SemVer[]>>();

    constructor(initVersions: string[]) {
        initVersions.forEach(v => {
            this.addVersion(new SemVer(v));
        });
    }

    public getLatest(): SemVer {
        const major = Array.from(this.versions.keys()).sort().reverse()[0];
        const minor = Array.from(this.versions.get(major)!.keys()).sort().reverse()[0];

        return this.versions.get(major)!.get(minor)![0];
    }

    public async fetchNewFromGitHub(org: string, repository: string) {
        const octokit = new Octokit();

        const releases = await octokit.rest.repos.listReleases({
            owner: org,
            repo: repository,
        });
    }

    private addVersion(v: SemVer): void {
        if (!this.versions.has(v.major)) {
            this.versions.set(v.major, new Map<number, SemVer[]>());
        }
        if (!this.versions.get(v.major)!.has(v.minor)) {
            this.versions.get(v.major)!.set(v.minor, []);
        }

        const patches = this.versions.get(v.major)!.get(v.minor)!;
        patches.push(v);
        this.versions.get(v.major)!.set(v.minor, semver.rsort(patches));
    }
}
