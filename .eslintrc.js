const OFF = 0, WARN = 1, ERROR = 2;

const memberOrdering = [
    // Index signature.

    'signature',

    // Static fields.

    'public-static-field',
    'protected-static-field',
    'private-static-field',

    // Fields.

    'public-decorated-field',
    'protected-decorated-field',
    'private-decorated-field',

    'public-instance-field',
    'protected-instance-field',
    'private-instance-field',

    'public-abstract-field',
    'protected-abstract-field',
    'private-abstract-field',

    // Static methods.

    'public-static-method',
    'protected-static-method',
    'private-static-method',

    // Constructors.

    'public-constructor',
    'protected-constructor',
    'private-constructor',

    // Methods.

    'public-decorated-method',
    'protected-decorated-method',
    'private-decorated-method',

    'public-instance-method',
    'protected-instance-method',
    'private-instance-method',

    'public-abstract-method',
    'protected-abstract-method',
    'private-abstract-method',
];

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser.
    plugins: ['@typescript-eslint', 'unused-imports', 'import'],
    extends: [
        // Uses the recommended rules from the @typescript-eslint/eslint-plugin.
        'plugin:@typescript-eslint/recommended',
    ],
    parserOptions: {
        ecmaVersion: 2015, // Allows for the parsing of modern ECMAScript features.
        sourceType: 'module', // Allows for the use of imports.
    },
    rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules
        // specified from the extended configs e.g.
        'max-len': [ERROR, 240],
        'prefer-const': [ERROR],
        'semi': [ERROR],
        'eqeqeq': [ERROR],
        'no-trailing-spaces': [ERROR],
        'quotes': [ERROR, 'single'],
        'arrow-spacing': [ERROR],
        '@typescript-eslint/explicit-member-accessibility': [OFF],
        'space-before-blocks': [ERROR],
        'comma-dangle': [ERROR, 'always-multiline'],
        '@typescript-eslint/ban-ts-comment': [ERROR, {
            'ts-expect-error': false,
        }],
        '@typescript-eslint/interface-name-prefix': [OFF],
        '@typescript-eslint/no-var-requires': [WARN],
        '@typescript-eslint/no-use-before-define': [OFF],
        '@typescript-eslint/no-empty-function': [OFF],
        '@typescript-eslint/naming-convention': [
            ERROR,
            {
                selector: 'default',
                format: ['camelCase'],
            },
            {
                selector: 'typeParameter',
                format: ['StrictPascalCase'],
                // Multichar type parameters end with a T.
                custom: {
                    regex: '[a-z]^T',
                    match: false,
                },
            },
            {
                selector: 'variable',
                format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
            },
            {
                selector: 'parameter',
                modifiers: ['unused'],
                format: ['camelCase'],
                leadingUnderscore: 'allow',
            },
            {
                selector: ['typeLike', 'enumMember'],
                format: ['PascalCase'],
            },
            {
                selector: 'property',
                // Off because we use interfaces for objects that come directly
                // from SQL databases which are usually not camel cased.
                format: [],
            },
            {
                selector: 'interface',
                format: ['PascalCase'],
                // Interfaces don't start with an I.
                custom: {
                    regex: '^I[A-Z]',
                    match: false,
                },
            },
        ],
        '@typescript-eslint/consistent-type-assertions': [WARN],
        // Only FIXME and XXX are forbidden. Other dev notes are allowed.
        'no-warning-comments': [ERROR, {'terms': ['fixme', 'xxx'], 'location': 'start'}],
        '@typescript-eslint/no-inferrable-types': [OFF],
        'keyword-spacing': [ERROR, {
            before: true,
            after: true,
        }],
        'unused-imports/no-unused-imports': ERROR,
        'no-var': [ERROR],
        'object-curly-spacing': [ERROR, 'never'],
        'import/order': [ERROR, {
            'newlines-between': 'never',
            pathGroups: [
                {
                    pattern: '@codesphere/**',
                    group: 'external',
                    position: 'after',
                },
            ],
            pathGroupsExcludedImportTypes: [],
        }],
        'curly': [ERROR, 'multi-line', 'consistent'],
        'no-multiple-empty-lines': [ERROR, {max: 1}],
        /**
         * Prevent statements like `if ('red' === color)`.
         */
        'yoda': [ERROR],
        'comma-spacing': [ERROR, {
            before: false,
            after: true,
        }],
        /**
         * Prohibit spaces around brackets.
         */
        'array-bracket-spacing': [ERROR],
        /**
         * Enforces spaces after colon but not before
         */
         'key-spacing': [ERROR, {'afterColon': true}],
        /**
         * No with keyword.
         */
        'no-with': [ERROR],
        /**
         * Enforce newline at the end of files.
         */
        'eol-last': [ERROR, 'always'],
        /**
         * Only allow triple equal operators (`===` and `!==`).
         */
        'eqeqeq': [ERROR, 'always'],
        'func-style': [ERROR, 'expression'],
        /**
         * Disallow shadowing of names such as `arguments`.
         */
        'no-shadow-restricted-names': [ERROR],
        /**
         * Prohibit the use of `eval()`.
         */
        'no-eval': [ERROR],
        /**
         * Require to use a property shorthand if the object's key and a variable name are the same.
         */
        'object-shorthand': [ERROR, 'properties'],
        /**
         * Prohibit the use of else statement if the if statement returns.
         */
        'no-else-return': [ERROR],
        /**
         * Enforce the first letter of a block comment to be capitalized.
         */
        'capitalized-comments': [ERROR, 'always', {
            line: {
                ignorePattern: '.*',
                ignoreInlineComments: true,
                ignoreConsecutiveComments: true,
            },
        }],
        /**
         * Enforce a space in the beginning of a comment line.
         */
        'spaced-comment': [ERROR],
        'max-lines-per-function': [ERROR, {
            max: 120,
            skipComments: true,
            skipBlankLines: true,
        }],
    },
    env: {
        browser: true,
        node: true,
    },
    overrides: [
        {
            // Enable the rule specifically for TypeScript files.
            files: ['*.ts', '*.tsx'],
            rules: {
                '@typescript-eslint/explicit-member-accessibility': [ERROR,
                    {
                        accessibility: 'explicit',
                        overrides: {
                            accessors: 'explicit',
                            constructors: 'off',
                            methods: 'explicit',
                            properties: 'explicit',
                            parameterProperties: 'explicit',
                        },
                    },
                ],
            },
        },
        {
            files: ['**/__tests__/**'],
            rules: {
                'max-lines-per-function': [OFF],
            },
        }
    ],
};
