import semver from 'semver';
import {SemVer} from 'semver';
import {Octokit} from '@octokit/rest';

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
