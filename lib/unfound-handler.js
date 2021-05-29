import accepts from 'accepts'
import fs from 'fs'
import {gray, yellow} from 'sergeant'
import {promisify} from 'util'

import {find} from './resolver.js'

const readFile = promisify(fs.readFile)

export const unfoundHandler = async (req, res, meta) => {
  const reqAccepts = accepts(req)

  if (!meta.stats && meta.args['--entry']) {
    if (reqAccepts.type(['txt', 'html']) === 'html') {
      meta.dependencies.splice(0, meta.dependencies.length)

      const {stats, pathname} = await find(
        meta.args['--template'],
        meta.args.src
      )

      if (stats) {
        let html = await readFile(pathname, 'utf8')

        const headers = {
          'Content-Type': 'text/html; charset=UTF-8'
        }

        res.writeHead(200, headers)

        html = html.replace(
          '</body>',
          `<script type="module" src="/${meta.args['--entry']}"></script></body>`
        )

        res.end(html)

        return true
      }
    }
    res.writeHead(404)

    res.end('')

    console.log(
      `${gray('[dev]')} ${req.method} ${yellow(404)} ${meta.url.pathname}`
    )

    return true
  }
}
