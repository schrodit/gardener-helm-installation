#!/bin/env -S node --loader ts-node/esm
import {Installation} from './src/ts/Installation';
const {program} = require('commander');

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

