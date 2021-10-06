#!/usr/bin/env node --experimental-import-meta-resolve --preserve-symlinks

import arg from 'arg';
import assert from 'assert';
import {green} from 'kleur/colors';

import {serve} from './serve.js';

const usage = `
@erickmerchant/dev-cli

${green('Usage:')}

  dev [options] --src <string>

  start a development server

${green('Options:')}

  --src <string>, -s <string>     a directory to serve files from

  --argument <various> ..., 
          -a <various> ...        sent to _main (boolean, number, or string)

  --entry <string>, -e <string>   html entry point

  --port <number>, -p <number>    preferred port

  -d, --dev                       output source maps, watch for changes, etc.

  -h, --help                      display this message

`;

try {
  const args = arg({
    '--src': String,
    '--dev': Boolean,
    '--argument': [String],
    '--entry': String,
    '--port': Number,
    '--help': Boolean,
    '-s': '--src',
    '-d': '--dev',
    '-a': '--argument',
    '-e': '--entry',
    '-p': '--port',
    '-h': '--help',
  });

  if (args['--help']) {
    console.log(usage);
  } else {
    assert.ok(args._.length === 0, RangeError(`Too many arguments`));

    assert.ok(args['--src'], '--src is required');

    if (!args['--entry']) {
      args['--entry'] = 'index.html';
    }

    await serve(args);
  }
} catch (error) {
  console.error(error);

  process.exit(1);
}
