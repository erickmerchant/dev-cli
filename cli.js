#!/usr/bin/env node --experimental-import-meta-resolve --preserve-symlinks

import arg from 'arg'
import assert from 'assert'
import {bold, green} from 'kleur/colors'

import {cache} from './cache.js'
import {serve} from './serve.js'

const usage = `
@erickmerchant/dev-cli

${green('Usage:')}

  ${bold('start a development server')}

    dev serve [-d] [-a <arguments>...] [-e <entry>] [-p <port>] <src>

  ${bold('save results to deploy to a static server')}

    dev cache [-d] [-a <arguments>...] [-e <entry>] <src> <dist>

${green('Options:')}

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

`

try {
  const args = arg({
    '--dev': Boolean,
    '--argument': [String],
    '--entry': String,
    '--port': Number,
    '--help': Boolean,
    '-d': '--dev',
    '-a': '--argument',
    '-e': '--entry',
    '-p': '--port',
    '-h': '--help'
  })

  if (args['--help']) {
    console.log(usage)
  } else {
    const [command, ...additional] = args._

    args.command = command

    assert.ok(
      ['serve', 'cache'].includes(command),
      `unkonwn command "${command}"`
    )

    if (command === 'cache') {
      const [src, dist] = additional

      args.dist = dist

      args.src = src

      await cache(args)
    } else {
      const [src] = additional

      args.src = src

      await serve(args)
    }
  }
} catch (error) {
  console.error(error)

  process.exit(1)
}
