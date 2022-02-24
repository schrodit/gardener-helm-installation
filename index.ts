#!/bin/env -S node --loader ts-node/esm
const { program } = require('commander');
import { Installation } from './src/ts/Installation';
import { execAsync } from './src/ts/utils/execAsync';

program.option('--dryRun [dryRun]');
program.option('-f, --values [letters...]');

void (async function () {
  program.parse();
  const args = program.opts();
  const dryRun = args.dryRun === 'true';

  const inst = await Installation.run({
    dryRun,
    defaultNamespace: 'default',
    valueFiles: args.values,
  });

})();

