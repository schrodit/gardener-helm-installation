import {getLatestVersionForMinor, Versions} from '../Versions';
import {SemVer} from 'semver';

describe('Versions', () => {

    describe('getLatest', () => {

        it('return the latest version', () => {
            const versions = new Versions([
                '0.0.1',
                '0.0.2',
                '0.0.7',
                '1.0.0',
            ]);
            expect(versions.getLatest().raw).toEqual('1.0.0');
        });

    });

    it('return original version', () => {
        const versions = new Versions([
            'v1.0.0',
        ]);
        expect(versions.getLatest().raw).toEqual('v1.0.0');
    });

    it('return normalized version', () => {
        const versions = new Versions([
            'v1.0.0',
        ]);
        expect(versions.getLatest().version).toEqual('1.0.0');
    });

    describe('getLatestVersionForMinor', () => {
        it('should get latest minor version 1.3.9', () => {
            const res = getLatestVersionForMinor(new SemVer('v1.3.0'), [
                new SemVer('v1.2.0'),
                new SemVer('v1.3.0'),
                new SemVer('v1.3.1'),
                new SemVer('v1.3.9'),
                new SemVer('v1.4.9'),
            ]);
            expect(res).toBeDefined();
            expect(res!.raw).toEqual('v1.3.9');
        });

        it('should return given version if latest', () => {
            const res = getLatestVersionForMinor(new SemVer('v1.3.2'), [
                new SemVer('v1.2.0'),
                new SemVer('v1.3.0'),
                new SemVer('v1.3.1'),
                new SemVer('v1.3.2'),
                new SemVer('v1.4.9'),
            ]);
            expect(res).toBeDefined();
            expect(res!.raw).toEqual('v1.3.2');
        });
    });

});
