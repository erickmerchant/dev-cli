import accepts from 'accepts'
import chokidar from 'chokidar'
import fs from 'fs'
import {createServer} from 'http'
import mime from 'mime-types'
import path from 'path'
import {gray, green, red, yellow} from 'sergeant'
import {finished as _finished} from 'stream'
import {URL} from 'url'
import {promisify} from 'util'

import {getStat} from './lib/get-stat.js'
import {htmlAsset} from './lib/html-asset.js'
import {jsAsset} from './lib/js-asset.js'
import {find} from './lib/resolver.js'

const finished = promisify(_finished)
const unlink = promisify(fs.unlink)
const readFile = promisify(fs.readFile)
const cwd = process.cwd()

export const serve = async (args) => {
  const assets = [htmlAsset(args), jsAsset(args)]

  const etagSuffix = Date.now().toString(16)

  const onRequestHandler = async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    let from = pathname

    try {
      if (req.headers.accept === 'text/event-stream') {
        const headers = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }

        res.writeHead(200, headers)

        const changedFiles = []
        let timeout

        const getWatchCallback = (src) => (type, file) => {
          file = path.relative(path.join(cwd, src), file)

          if (!changedFiles.includes(file)) {
            changedFiles.push(file)

            if (timeout) {
              clearTimeout(timeout)
            }

            timeout = setTimeout(
              () =>
                res.write(
                  `data: ${JSON.stringify({
                    files: changedFiles.splice(0, changedFiles.length)
                  })}\n\n`
                ),
              500
            )
          }
        }

        for (const src of args.src) {
          chokidar
            .watch(path.join(cwd, src), {ignoreInitial: true})
            .on('all', getWatchCallback(src))
        }

        res.write(`\n\n`)

        console.log(
          `${gray('[dev]')} ${req.method} ${green(200)} ${pathname} ${gray(
            'text/event-stream'
          )}`
        )
      } else {
        const files = await find(pathname, args.src)
        let file = files.shift()
        let stat = await getStat(file)

        if (pathname.endsWith('.json')) {
          if (req.method === 'POST' || req.method === 'PUT') {
            if (stat && req.method === 'POST') {
              res.writeHead(409)

              res.end('')

              console.log(
                `${gray('[dev]')} ${req.method} ${yellow(409)} ${pathname}`
              )

              return
            }

            const writeStream = fs.createWriteStream(file)

            req.pipe(writeStream)

            await finished(writeStream)

            const statusCode = stat ? 200 : 201
            const contentType = mime.contentType('.json')

            res.writeHead(statusCode, {
              'Content-Type': contentType
            })

            res.end('')

            console.log(
              `${gray('[dev]')} ${req.method} ${green(
                statusCode
              )} ${pathname} ${gray(contentType)}`
            )

            return
          }

          if (req.method === 'DELETE') {
            if (stat) {
              await unlink(file)
            }

            res.writeHead(200)

            res.end('')

            console.log(
              `${gray('[dev]')} ${req.method} ${green(200)} ${pathname}`
            )

            return
          }
        }

        if (req.method !== 'GET') {
          res.writeHead(405)

          res.end('')

          console.log(
            `${gray('[dev]')} ${req.method} ${yellow(405)} ${pathname}`
          )

          return
        }

        if (!stat) {
          while (files.length) {
            file = files.shift()

            stat = await getStat(file)

            if (stat) {
              break
            }
          }
        }

        const reqAccepts = accepts(req)

        if (!stat) {
          if (reqAccepts.type(['txt', 'html']) === 'html') {
            for (const src of args.src) {
              if (!stat) {
                file = path.join(cwd, src, args['--entry'] ?? 'index.html')

                from = args['--entry'] ?? 'index.html'

                stat = await getStat(file)
              }
            }
          }

          if (!stat) {
            res.writeHead(404)

            res.end('')

            console.log(
              `${gray('[dev]')} ${req.method} ${yellow(404)} ${pathname}`
            )

            return
          }
        }

        const etag = `W/"${stat.size.toString(
          16
        )}-${stat.mtime.getTime().toString(16)}-${etagSuffix}"`

        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304)

          res.end('')

          console.log(
            `${gray('[dev]')} ${req.method} ${green(304)} ${pathname}`
          )

          return
        }

        let read = await readFile(file)

        let transform

        for (const asset of assets) {
          if (asset.extensions.includes(path.extname(file))) {
            transform = asset.transform

            break
          }
        }

        if (transform) {
          read = await transform(file, read)
        }

        const contentType = mime.contentType(path.extname(file))

        const headers = {
          'ETag': etag,
          'Content-Type': contentType
        }

        res.writeHead(200, headers)

        res.end(read)

        console.log(
          `${gray('[dev]')} ${req.method} ${green(200)} ${from} ${gray(
            contentType
          )}`
        )
      }
    } catch (err) {
      console.error(err)

      res.writeHead(500)

      res.end('')

      console.log(`${gray('[dev]')} ${req.method} ${red(500)} ${from}`)
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
