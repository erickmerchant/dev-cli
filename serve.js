import {createServer} from 'http'
import mime from 'mime-types'
import accepts from 'accepts'
import {promisify} from 'util'
import compressible from 'compressible'
import zlib from 'zlib'
import assert from 'assert'
import {gray, green, yellow, red} from 'kleur/colors'
import path from 'path'
import url from 'url'
import fs from 'fs'
import {finished as _finished, pipeline, Readable} from 'stream'
import chokidar from 'chokidar'
import htmlAsset from './lib/html-asset.js'
import jsAsset from './lib/js-asset.js'
import getStat from './lib/get-stat.js'

const pipe = promisify(pipeline)
const finished = promisify(_finished)
const unlink = promisify(fs.unlink)
const cwd = process.cwd()
const noop = () => {}

export default async (args, cb = noop) => {
  assert.ok(args.src != null, '<src> is required')

  const {find} = await import('./lib/resolver.js')

  const assets = [htmlAsset(args), jsAsset(args)]

  const onRequestHandler = async (req, res) => {
    const from = url.parse(req.url).pathname

    try {
      if (req.headers.accept === 'text/event-stream') {
        const headers = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }

        res.writeHead(200, headers)

        chokidar
          .watch(path.join(cwd, args.src), {ignoreInitial: true})
          .on('all', (type, file) => {
            file = path.relative(path.join(cwd, args.src), file)

            res.write(`data: ${JSON.stringify({type, file})}\n\n`)
          })

        res.write(`\n\n`)

        process.stdout.write(
          `${gray('[dev]')} ${req.method} ${green(200)} ${from} ${gray(
            'text/event-stream'
          )}\n`
        )
      } else {
        let file = find(from, args.src)
        let stat = await getStat(file)

        if (from.endsWith('.json')) {
          if (req.method === 'POST') {
            const writeStream = fs.createWriteStream(file)

            req.pipe(writeStream)

            await finished(writeStream)

            const statusCode = stat ? 200 : 201
            const contentType = mime.contentType('.json')

            res.writeHead(statusCode, {
              'Content-Type': contentType
            })

            res.end('')

            process.stdout.write(
              `${gray('[dev]')} ${req.method} ${green(
                statusCode
              )} ${from} ${gray(contentType)}\n`
            )

            return
          }

          if (req.method === 'DELETE') {
            await unlink(file)

            res.writeHead(200)

            res.end('')

            process.stdout.write(
              `${gray('[dev]')} ${req.method} ${green(200)} ${from}\n`
            )

            return
          }
        }

        if (req.method !== 'GET') {
          res.writeHead(405)

          res.end('')

          process.stdout.write(
            `${gray('[dev]')} ${req.method} ${yellow(405)} ${from}\n`
          )

          return
        }

        const reqAccepts = accepts(req)

        if (!stat) {
          if (reqAccepts.type(['txt', 'html']) === 'html') {
            file = path.join(cwd, args.src, args['--entry'] ?? 'index.html')

            stat = await getStat(file)
          }

          if (!stat) {
            res.writeHead(404)

            res.end('')

            process.stdout.write(
              `${gray('[dev]')} ${req.method} ${yellow(404)} ${from}\n`
            )

            return
          }
        }

        const etag = `W/"${stat.size.toString(
          16
        )}-${stat.mtime.getTime().toString(16)}"`

        if (
          reqAccepts.type(['txt', 'html']) !== 'html' &&
          req.headers['if-none-match'] === etag
        ) {
          res.writeHead(304)

          res.end('')

          process.stdout.write(
            `${gray('[dev]')} ${req.method} ${green(304)} ${from}\n`
          )

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

          const result = await transform(from, code)

          readStream = Readable.from(result)
        }

        const contentType = mime.contentType(path.extname(file))
        const encoding = compressible(contentType)
          ? reqAccepts.encoding(['br', 'gzip', 'deflate'])
          : false

        const headers = {
          'ETag': etag,
          'Content-Type': contentType
        }

        if (encoding) {
          headers['Content-Encoding'] = encoding
        }

        res.writeHead(200, headers)

        switch (encoding) {
          case 'br':
            pipe(readStream, zlib.createBrotliCompress(), res)
            break

          case 'gzip':
            pipe(readStream, zlib.createGzip(), res)
            break

          case 'deflate':
            pipe(readStream, zlib.createDeflate(), res)
            break

          default:
            readStream.pipe(res)
        }

        process.stdout.write(
          `${gray('[dev]')} ${req.method} ${green(200)} ${from} ${gray(
            contentType
          )}\n`
        )
      }
    } catch (err) {
      process.stderr.write(`${err}\n`)

      res.writeHead(500)

      res.end('')

      process.stdout.write(
        `${gray('[dev]')} ${req.method} ${red(500)} ${from}\n`
      )
    }
  }

  const app = createServer(onRequestHandler)

  app.listen(args['--port'] ?? 3000, (err) => {
    if (err) {
      process.stderr.write(`${err}\n`)
    } else {
      process.stdout.write(
        `${gray('[dev]')} go to http://localhost:${args['--port'] ?? 3000}\n`
      )
    }

    cb(err, app)
  })
}
