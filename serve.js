import devcert from 'devcert'
import {createServer} from 'https'
import {gray, red} from 'kleur/colors'
import {URL} from 'url'

import {changeHandler} from './lib/change-handler.js'
import {fileHandler} from './lib/file-handler.js'
import {jsonHandler} from './lib/json-handler.js'
import {unfoundHandler} from './lib/unfound-handler.js'

export const serve = async (args) => {
  const onRequestHandler = async (req, res) => {
    const url = new URL(req.url, 'https://localhost')

    try {
      for (const handler of [
        changeHandler,
        jsonHandler,
        unfoundHandler,
        fileHandler
      ]) {
        const handled = await handler(req, res, url, args)

        if (handled) {
          break
        }
      }
    } catch (err) {
      console.error(err)

      res.writeHead(500)

      res.end('')

      console.log(`${gray('[dev]')} ${req.method} ${red(500)} ${url.pathname}`)
    }
  }

  const ssl = await devcert.certificateFor('dev-cli.app')

  const app = createServer(ssl, onRequestHandler)

  app.listen(args['--port'] ?? 3000, (err) => {
    if (err) {
      console.error(err)
    } else {
      console.log(
        `${gray('[dev]')} go to https://localhost:${args['--port'] ?? 3000}`
      )
    }
  })
}
