#!/usr/bin/env node --experimental-import-meta-resolve --preserve-symlinks

import assert from 'assert'
import {arg, bold, green} from 'sergeant'

import {cache} from './cache.js'
import {serve} from './serve.js'

const usage = `
${green('@erickmerchant/dev-cli')}

${green('Usage:')}

  ${bold('start a development server')}

    dev serve [-d] [-p <port>] [-e <entry>] -- <src> [<src> ...]

  ${bold('save results to deploy to a static server')}

    dev cache [-d]  [-i <ignore> ...] -- <src> <dist>

${green('Options:')}

  ${bold('-d, --dev')}

    output source maps

  ${bold('-p <port>, --port <port>')}

    port to listen at

  ${bold('-e <entry>, --entry <entry>')}

    an alternate html to serve

  ${bold('-i <ignore>, --ignore <ignore>')}

    files to not copy

  ${bold('-h, --help')}

    display this message

`

try {
  const args = arg({
    '--dev': Boolean,
    '--port': Number,
    '--entry': String,
    '--ignore': [String],
    '--help': Boolean,
    '-d': '--dev',
    '-p': '--port',
    '-e': '--entry',
    '-i': '--ignore',
    '-h': '--help'
  })

  if (args['--help']) {
    console.log(usage)
  } else {
    const [command, ...additional] = args._

    assert.ok(
      ['serve', 'cache'].includes(command),
      `unkonwn command "${command}"`
    )

    if (command === 'cache') {
      assert.ok(
        additional.length === 2,
        RangeError(`too ${args._.length > 2 ? 'many' : 'few'} arguments`)
      )

      const [src, dist] = additional

      args.src = src

      args.dist = dist

      await cache(args)
    } else {
      assert.ok(additional.length > 0, RangeError(`too few arguments`))

      args.src = additional

      await serve(args)
    }
  }
} catch (error) {
  console.error(error)

  process.exit(1)
}
