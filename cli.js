#!/usr/bin/env node --experimental-import-meta-resolve --preserve-symlinks

import arg from 'arg';
import assert from 'assert';
import {bold, green} from 'kleur/colors';

import {serve} from './serve.js';

const usage = `
@erickmerchant/dev-cli

${green('Usage:')}

  ${bold('start a development server')}

    dev serve (<src> | -s <src>) [options]

${green('Options:')}

  ${bold('-s, --src')}

    a directory to serve files from

  ${bold('-d, --dev')}

    output source maps, watch for changes, etc.

  ${bold('-a, --argument <argument>')}

    sent to _main. numbers, booleans, and strings are supported

  ${bold('-e, --entry <entry>')}

    template for html

  ${bold('-p, --port')}

    preferred port

  ${bold('-h, --help')}

    display this message

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
    assert.ok(args._.length === 1, RangeError(`Too many arguments`));

    const [command] = args._;

    assert.ok(['serve'].includes(command), `unkonwn command "${command}"`);

    if (command === 'serve') {
      await serve(args);
    }
  }
} catch (error) {
  console.error(error);

  process.exit(1);
}
