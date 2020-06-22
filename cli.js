#!/usr/bin/env node --experimental-import-meta-resolve

import arg from 'arg'
import {green, bold} from 'kleur/colors'

const usage = `
${green('@erickmerchant/dev-cli')}

${bold('Usage:')}

 $ dev serve [-p <port>] [-d] [-e <entry>] -- <src>
 $ dev cache [-d] -- <src> <dist>

${bold('Options:')}

 -d, --dev    output source maps
 -p, --port   port to listen at
 -e, --entry  an alternate html to serve
 -h, --help   display this message
`

const devOptions = {
  '--dev': Boolean,
  '-d': '--dev'
}

const program = async () => {
  try {
    const args = arg({
      ...devOptions,
      '--port': Number,
      '--entry': String,
      '--help': Boolean,
      '-p': '--port',
      '-e': '--entry',
      '-h': '--help'
    })

    if (args['--help']) {
      console.log(usage)

      process.exit(2)
    }

    const [command, src, dist] = args._

    Object.assign(args, {src, dist})

    if (!['serve', 'cache'].includes(command)) {
      throw Error(`unkonwn command "${command}"`)
    }

    const action = await import(`./${command}.js`)

    await action.default(args)
  } catch (error) {
    console.error(error)

    process.exit(1)
  }
}

program()
