import {createServer} from 'http'
import {gray, red} from 'sergeant'
import {URL} from 'url'

import {changeHandler} from './lib/change-handler.js'
import {fileHandler} from './lib/file-handler.js'
import {jsonHandler} from './lib/json-handler.js'
import {find} from './lib/resolver.js'
import {unfoundHandler} from './lib/unfound-handler.js'

export const serve = async (args) => {
  const dependencies = []

  const onRequestHandler = async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const found = await find(url.pathname, args.src)
    const meta = {
      ...found,
      dependencies,
      args,
      url
    }

    const pathname = url.pathname

    try {
      for (const handler of [
        changeHandler,
        jsonHandler,
        unfoundHandler,
        fileHandler
      ]) {
        const handled = await handler(req, res, meta)

        if (handled) {
          break
        }
      }
    } catch (err) {
      console.error(err)

      res.writeHead(500)

      res.end('')

      console.log(`${gray('[dev]')} ${req.method} ${red(500)} ${pathname}`)
    }
  }

  const app = createServer(onRequestHandler)

  app.listen(args['--port'] ?? 3000, (err) => {
    if (err) {
      console.error(err)
    } else {
      console.log(
        `${gray('[dev]')} go to http://localhost:${args['--port'] ?? 3000}`
      )
    }
  })
}
