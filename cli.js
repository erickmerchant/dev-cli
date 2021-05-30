#!/usr/bin/env node --experimental-import-meta-resolve --preserve-symlinks

import assert from 'assert'
import {arg, bold, green} from 'sergeant'

import {cache} from './cache.js'
import {serve} from './serve.js'

const usage = `
${green('@erickmerchant/dev-cli')}

${green('Usage:')}

  ${bold('start a development server')}

    dev serve [-d] [-e <entry>] [-p <port>] <src> [<src>...]

  ${bold('save results to deploy to a static server')}

    dev cache [-d] [-e <entry>] <dist> <src> [<src>...]

${green('Options:')}

  ${bold('-d, --dev')}

    output source maps, watch for changes, etc.

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
    '--entry': String,
    '--port': Number,
    '--help': Boolean,
    '-d': '--dev',
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
      const [dist, ...src] = additional

      args.dist = dist

      args.src = src

      await cache(args)
    } else {
      const src = additional

      args.src = src

      await serve(args)
    }
  }
} catch (error) {
  console.error(error)

  process.exit(1)
}
