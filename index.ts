#!/bin/env -S node --loader ts-node/esm
import {Installation} from './src/ts/Installation';
import {createLogger, logCollector} from './src/ts/log/Logger';
import {has} from "@0cfg/utils-common/lib/has";
const {program} = require('commander');

program.option('--dryRun [dryRun]');
program.option('--level [logLevel]');
program.option('--log-format [logFormat]');
program.option('-f, --values [letters...]');

void (async function () {
  program.parse();
  const args = program.opts();
  const dryRun = args.dryRun === 'true';
  if (has(args.level)) {
    const logLevel = args.level;
    logCollector.setLevel(logLevel);
    console.log(`Log level set to ${logLevel}`);
  }
  if (has(args['log-format'])) {
    logCollector.setFormat(args['log-format']);
  }

  const inst = await Installation.run({
    dryRun,
    defaultNamespace: 'default',
    valueFiles: args.values,
  });

})();

