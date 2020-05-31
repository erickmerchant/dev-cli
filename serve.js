const createServer = require('http').createServer
const mime = require('mime-types')
const accepts = require('accepts')
const promisify = require('util').promisify
const compression = promisify(require('compression')())
const {gray} = require('kleur')
const path = require('path')
const url = require('url')
const error = require('sergeant/error')
const fs = require('fs')
const finished = promisify(require('stream').finished)
const unlink = promisify(fs.unlink)
const del = require('del')
const cacheDir = require('find-cache-dir')({name: 'dev'}) ?? '.cache'
const htmlAsset = require('./lib/html-asset.js')
const cssAsset = require('./lib/css-asset.js')
const jsAsset = require('./lib/js-asset.js')
const getStat = require('./lib/get-stat.js')
const cacheTransform = require('./lib/cache-transform.js')
const {console} = require('./lib/globals.js')
const getResolver = require('./lib/get-resolver.js')
const cwd = process.cwd()
const noop = () => {}

module.exports = async (args, cb = noop) => {
  await del([cacheDir])

  const resolver = await getResolver(args.importmap)

  const assets = [
    htmlAsset(args, resolver),
    cssAsset(args, resolver),
    jsAsset(args, resolver)
  ]

  const app = createServer(async (req, res) => {
    try {
      const from = url.parse(req.url).pathname

      if (req.headers.accept === 'text/event-stream') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'connection': 'keep-alive',
          'cache-control': 'no-cache'
        })

        fs.watch(
          path.join(cwd, args.src),
          {recursive: true, persistent: true},
          (type, file) => {
            res.write(`data: ${JSON.stringify({type, file})}\n\n`)
          }
        )

        res.write(`\n\n`)
      } else {
        let file = path.join(cwd, args.src, from)
        let stat = await getStat(file)

        await compression(req, res)

        if (from.endsWith('.json')) {
          if (req.method === 'POST') {
            const writeStream = fs.createWriteStream(file)

            req.pipe(writeStream)

            await finished(writeStream)

            res.writeHead(stat ? 200 : 201)

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
          file = path.join(cwd, from)

          stat = await getStat(file)

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
        }

        const etag = `W/"${stat.size.toString(
          16
        )}-${stat.mtime.getTime().toString(16)}"`

        if (req.headers['if-none-match'] === etag) {
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
          'etag': etag,
          'content-type': mime.contentType(path.extname(file))
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
