#!/usr/bin/env node --experimental-import-meta-resolve

import arg from 'arg'
import assert from 'assert'
import {green, bold} from 'kleur/colors'

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

const program = async () => {
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
      process.stdout.write(usage)

      process.exit(2)
    }

    const [command, ...additional] = args._

    assert.ok(
      ['serve', 'cache'].includes(command),
      `unkonwn command "${command}"`
    )

    if (command === 'cache') {
      const [src, dist] = additional

      args.src = src

      args.dist = dist
    } else {
      args.src = additional
    }

    const action = await import(`./${command}.js`)

    await action.default(args)
  } catch (error) {
    process.stderr.write(`${error}\n`)

    process.exit(1)
  }
}

program()
