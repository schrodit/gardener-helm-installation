import {getVersionsToInstall, Version} from '../InstallationManager';
import {SemVer} from 'semver';

describe('getVersionsToInstall', () => {

    it('get all minor updates', () => {
        const versions = [
            {version: new SemVer('v1.1.5')},
            {version: new SemVer('v1.1.6')},
            {version: new SemVer('v1.2.1')},
            {version: new SemVer('v1.2.6')},
            {version: new SemVer('v1.3.4')},
            {version: new SemVer('v1.3.5')},
            {version: new SemVer('v1.4.2')},
        ];
        const res = getVersionsToInstall(new SemVer('v1.1.0'), new SemVer('v1.3.4'), versions);
        expect(res.map(v => v.raw)).toEqual([
            'v1.2.6',
            'v1.3.4',
        ]);
    });

    it('respect patch versions with migrations', () => {
        const versions: Version[] = [
            {version: new SemVer('1.1.5')},
            {version: new SemVer('1.1.6')},
            {version: new SemVer('1.2.1'), hasMigration: true},
            {version: new SemVer('1.2.6')},
            {version: new SemVer('1.3.4')},
        ];
        const res = getVersionsToInstall(new SemVer('1.1.0'), new SemVer('1.3.4'), versions);
        expect(res.map(v => v.version)).toEqual([
            '1.2.1',
            '1.2.6',
            '1.3.4',
        ]);
    });

    it('current and target version are same minor versions', () => {
        const versions: Version[] = [
            {version: new SemVer('1.1.2')},
            {version: new SemVer('1.1.3')},
            {version: new SemVer('1.1.5')},
            {version: new SemVer('1.1.6')},
            {version: new SemVer('1.2.6')},
        ];
        const res = getVersionsToInstall(new SemVer('1.1.1'), new SemVer('1.1.3'), versions);
        expect(res.map(v => v.version)).toEqual([
            '1.1.3',
        ]);
    });

    it('current and target version are same minor versions and include a migration', () => {
        const versions: Version[] = [
            {version: new SemVer('1.1.2'), hasMigration: true},
            {version: new SemVer('1.1.3')},
            {version: new SemVer('1.1.5')},
            {version: new SemVer('1.1.6')},
            {version: new SemVer('1.2.6')},
        ];
        const res = getVersionsToInstall(new SemVer('1.1.1'), new SemVer('1.1.3'), versions);
        expect(res.map(v => v.version)).toEqual([
            '1.1.2',
            '1.1.3',
        ]);
    });

    it('current and target version equal', () => {
        const versions: Version[] = [
            {version: new SemVer('1.1.2')},
            {version: new SemVer('1.1.3')},
            {version: new SemVer('1.1.5')},
            {version: new SemVer('1.1.6')},
            {version: new SemVer('1.2.6')},
        ];
        const res = getVersionsToInstall(new SemVer('1.1.3'), new SemVer('1.1.3'), versions);
        expect(res.map(v => v.version)).toEqual([
            '1.1.3',
        ]);
    });

});
