import {nonRedundantDnsNames} from '../DNS';

describe('DNS', () => {

    describe('nonRedundantDnsNames', () => {

        it('should remove duplicated dns', () => {
            const res = nonRedundantDnsNames([
                '*.example.com',
                'api.example.com',
                'example.com',
            ]);
            expect(res.sort()).toEqual([
                '*.example.com',
                'example.com',
            ].sort());
        });

    });

});
