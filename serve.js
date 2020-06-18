import {createServer} from 'http'
import mime from 'mime-types'
import accepts from 'accepts'
import {promisify} from 'util'
import _compression from 'compression'
import {gray} from 'kleur/colors'
import path from 'path'
import url from 'url'
import error from 'sergeant/error.js'
import fs from 'fs'
import {finished as _finished} from 'stream'
import del from 'del'
import chokidar from 'chokidar'
import findCacheDir from 'find-cache-dir'
import htmlAsset from './lib/html-asset.js'
import jsAsset from './lib/js-asset.js'
import getStat from './lib/get-stat.js'
import cacheTransform from './lib/cache-transform.js'

const cacheDir = findCacheDir({name: 'dev'}) ?? '.cache'
const compression = promisify(_compression())
const finished = promisify(_finished)
const unlink = promisify(fs.unlink)
const cwd = process.cwd()
const noop = () => {}

export default async (args, cb = noop) => {
  await del([cacheDir])

  const {find} = await import('./lib/resolver.js')

  const assets = [htmlAsset(args), jsAsset(args)]

  const app = createServer(async (req, res) => {
    try {
      const from = url.parse(req.url).pathname

      if (req.headers.accept === 'text/event-stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        })

        chokidar
          .watch(path.join(cwd, args.src), {ignoreInitial: true})
          .on('all', (type, file) => {
            file = path.relative(path.join(cwd, args.src), file)

            res.write(`data: ${JSON.stringify({type, file})}\n\n`)
          })

        res.write(`\n\n`)
      } else {
        let file = find(from, args.src)
        let stat = await getStat(file)

        await compression(req, res)

        if (from.endsWith('.json')) {
          if (req.method === 'POST') {
            const writeStream = fs.createWriteStream(file)

            req.pipe(writeStream)

            await finished(writeStream)

            res.writeHead(stat ? 200 : 201, {
              'Content-Type': mime.contentType('.json')
            })

            res.end('')

            return
          }

          if (req.method === 'DELETE') {
            await unlink(file)

            res.writeHead(200)

            res.end('')

            return
          }
        }

        if (req.method !== 'GET') {
          res.writeHead(405)

          res.end('')

          return
        }

        if (!stat) {
          if (accepts(req).type(['txt', 'html']) === 'html') {
            file = path.join(cwd, args.src, args.entry)

            stat = await getStat(file)
          }

          if (!stat) {
            res.writeHead(404)

            res.end('')

            return
          }
        }

        const etag = `W/"${stat.size.toString(
          16
        )}-${stat.mtime.getTime().toString(16)}"`

        if (
          accepts(req).type(['txt', 'html']) !== 'html' &&
          req.headers['if-none-match'] === etag
        ) {
          res.writeHead(304)

          res.end('')

          return
        }

        let readStream = fs.createReadStream(file)

        let transform

        for (const asset of assets) {
          if (asset.extensions.includes(path.extname(file))) {
            transform = asset.transform

            break
          }
        }

        if (transform) {
          let code = []

          for await (const chunk of readStream) {
            code.push(chunk)
          }

          code = Buffer.concat(code)

          readStream = await cacheTransform({cacheDir, transform, code, from})
        }

        res.writeHead(200, {
          'ETag': etag,
          'Content-Type': mime.contentType(path.extname(file))
        })

        readStream.pipe(res)
      }
    } catch (err) {
      error(err)

      res.writeHead(500)

      res.end('')
    }
  })

  app.listen(args.port, (err) => {
    if (err) {
      error(err)
    } else {
      console.log(`${gray('[dev]')} go to http://localhost:${args.port}`)
    }

    cb(err, app)
  })
}
