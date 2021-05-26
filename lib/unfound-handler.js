import accepts from 'accepts'
import fs from 'fs'
import mime from 'mime-types'
import path from 'path'
import {gray, yellow} from 'sergeant'
import {promisify} from 'util'

import {htmlAsset} from './html-asset.js'
import {find} from './resolver.js'

const readFile = promisify(fs.readFile)

export const unfoundHandler = async (req, res, meta) => {
  let from = meta.url.pathname
  let stats = meta.stats
  let pathname = meta.pathname

  const reqAccepts = accepts(req)

  if (!meta.stats) {
    if (reqAccepts.type(['txt', 'html']) === 'html') {
      from = meta.args['--entry'] ?? 'index.html'

      if (!from.startsWith('/')) {
        from = `/${from}`
      }

      meta.dependencies.splice(0, meta.dependencies.length)

      const results = await find(from, meta.args.src)

      stats = results.stats

      pathname = results.pathname
    }

    if (!stats) {
      res.writeHead(404)

      res.end('')

      console.log(
        `${gray('[dev]')} ${req.method} ${yellow(404)} ${meta.url.pathname}`
      )

      return true
    }

    let code = await readFile(pathname)

    code = await htmlAsset(meta.args).transform(code, {
      ...meta,
      entry: true,
      pathname
    })

    const contentType = mime.contentType(path.extname(pathname))

    const headers = {
      'Content-Type': contentType
    }

    res.writeHead(200, headers)

    res.end(code)

    return true
  }
}
