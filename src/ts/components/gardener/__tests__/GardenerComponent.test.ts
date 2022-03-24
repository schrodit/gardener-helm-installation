import {SemVer} from 'semver';
import {GardenerComponent, LastVersionStateKey} from '../Gardener';
import {GeneralValues} from '../../../Values';
import {FakeKeyValueState} from '../../../state/FakeState';
import {VersionedTask} from '../../../flow/BaseComponent';
import {InstallationManager} from '../../../flow/InstallationManager';

class FakeDefaultTask extends VersionedTask {
    constructor() {
        super('Fake');
    }

    public copy(): VersionedTask {
        return new FakeDefaultTask();
    }

    public do(): Promise<void> {
        return Promise.resolve(undefined);
    }

}

describe('Gardener Component', () => {

    it('install next minor version', async () => {
        const state = new FakeKeyValueState<string>();
        state.store(LastVersionStateKey, 'v1.41.1');
        const comp = new GardenerComponent({gardener: {}} as GeneralValues, state);
        comp.setDefaultTask(new FakeDefaultTask());
        comp.addVersions(
            {version: new SemVer('v1.41.1')},
            {version: new SemVer('v1.41.2')},
            {version: new SemVer('v1.42.3')},
        );

        const tasks = await new InstallationManager().getSteps(comp);
        expect(tasks).toHaveLength(1);
        expect(tasks[0].name).toEqual('Fake-v1.42.3');
    });

    it('init install given version', async () => {
        const state = new FakeKeyValueState<string>();
        const comp = new GardenerComponent({gardener: {version: 'v1.41.2'}} as GeneralValues, state);
        comp.setDefaultTask(new FakeDefaultTask());
        comp.addVersions(
            {version: new SemVer('v1.41.1')},
            {version: new SemVer('v1.41.2')},
            {version: new SemVer('v1.42.3')},
        );

        const tasks = await new InstallationManager().getSteps(comp);
        expect(tasks).toHaveLength(1);
        expect(tasks[0].name).toEqual('Fake-v1.41.2');
    });

    it('install newer patch version', async () => {
        const state = new FakeKeyValueState<string>();
        state.store(LastVersionStateKey, 'v1.41.1');
        const comp = new GardenerComponent({gardener: {version: 'v1.41.2'}} as GeneralValues, state);
        comp.setDefaultTask(new FakeDefaultTask());
        comp.addVersions(
            {version: new SemVer('v1.41.1')},
            {version: new SemVer('v1.41.2')},
            {version: new SemVer('v1.42.3')},
        );

        const tasks = await new InstallationManager().getSteps(comp);
        expect(tasks).toHaveLength(1);
        expect(tasks[0].name).toEqual('Fake-v1.41.2');
    });

});
