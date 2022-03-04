import type {Config} from '@jest/types';

// Sync object
const config: Config.InitialOptions = {
    verbose: true,
    roots: [
        '<rootDir>/src',
    ],
    testEnvironment: 'node',
    collectCoverage: true,
    collectCoverageFrom: [
        '<rootDir>/**/*.ts',
        '!**/node_modules/**',
        '!**/__tests__/**',
        '!**/__integrationtests__/**',
    ],
    coverageDirectory: '.build-tmp/coverage',
    cacheDirectory: '.build-tmp/jest-cache',
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
    testPathIgnorePatterns: [
        '([A-Z]:)?((\w|[-_])*(\\|\/))*integration\.test\.ts$',
    ],
    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node',
    ],
    reporters: [
        'default',
        ['jest-junit', {
            outputDirectory: '.build-tmp',
            outputName: 'junit.xml',
        }],
    ],
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            tsconfig: {
                'target': 'ES2019',
                'module': 'commonjs',
                'declaration': true,
                'declarationMap': true,
                'sourceMap': true,
                'strict': true,
                'composite': true,
                'esModuleInterop': true,
                'incremental': true,
                'removeComments': true,
                'lib': [
                    'ES2020',
                ],
                'types': [
                    'jest',
                    'node',
                ],
                'experimentalDecorators': true,
                'emitDecoratorMetadata': true,
                'rootDir': 'src/__tests__',
                'outDir': 'lib',
                'tsBuildInfoFile': '.build-tmp/tsconfig.tsbuildinfo',
                'plugins': [
                    {
                        'transform': 'ts-type-checked/transformer',
                    },
                ],
            },
        },
    },
};
export default config;
