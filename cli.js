#!/usr/bin/env node --experimental-import-meta-resolve

import arg from 'arg'
import assert from 'assert'
import {green, bold} from 'kleur/colors'

const usage = `
${green('@erickmerchant/dev-cli')}

${green('Usage:')}

  ${bold('start a development server')}

    dev serve [-d] [-p <port>] [-e <entry>] [--http2] -- <src>

  ${bold('save results to deploy to a static server')}

    dev cache [-d] -- <src> <dist>

${green('Options:')}

  ${bold('-d, --dev')}

    output source maps

  ${bold('-p <port>, --port <port>')}

    port to listen at

  ${bold('-e <entry>, --entry <entry>')}

    an alternate html to serve

  ${bold('-2, --http2')}

    use http2. requires SSL_KEY_FILE and SSL_CERT_FILE
    environment variables with paths to key and cert pem
    files respectively

  ${bold('-h, --help')}

    display this message

`

const program = async () => {
  try {
    const args = arg({
      '--dev': Boolean,
      '--port': Number,
      '--entry': String,
      '--http2': Boolean,
      '--help': Boolean,
      '-d': '--dev',
      '-p': '--port',
      '-e': '--entry',
      '-2': '--http2',
      '-h': '--help'
    })

    if (args['--help']) {
      process.stdout.write(usage)

      process.exit(2)
    }

    const [command, src, dist] = args._

    Object.assign(args, {src, dist})

    assert.ok(
      ['serve', 'cache'].includes(command),
      `unkonwn command "${command}"`
    )

    const action = await import(`./${command}.js`)

    await action.default(args)
  } catch (error) {
    process.stderr.write(`${error}\n`)

    process.exit(1)
  }
}

program()
