#!/bin/env -S node --loader ts-node/esm
import {has} from '@0cfg/utils-common/lib/has';
import {program} from 'commander';
import {deploy} from './src/ts/Landscape';
import {createLogger, logCollector} from './src/ts/log/Logger';

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

  try {
    await deploy({
      dryRun,
      defaultNamespace: 'default',
      valueFiles: args.values,
    });
  } catch (error: any) {
      createLogger('').error(error);
      process.exit(1);
  }

})();

