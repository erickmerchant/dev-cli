#!/usr/bin/env node --experimental-import-meta-resolve

import assert from 'assert'
import {green, bold, arg} from 'sergeant'

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
      console.log(usage)

      return
    }

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
    } else {
      assert.ok(additional.length > 0, RangeError(`too few arguments`))

      args.src = additional
    }

    const action = await import(`./${command}.js`)

    await action.default(args)
  } catch (error) {
    console.error(error)

    process.exit(1)
  }
}

program()
