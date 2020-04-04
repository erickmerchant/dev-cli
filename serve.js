/* eslint-disable require-atomic-updates */

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
const fstat = promisify(fs.stat)
const finished = promisify(require('stream').finished)
const unlink = promisify(fs.unlink)
const del = require('del')
const cacheDir = require('find-cache-dir')({name: 'dev'}) || '.cache'
const htmlAsset = require('./lib/html-asset.js')
const cssAsset = require('./lib/css-asset.js')
const jsAsset = require('./lib/js-asset.js')
const getStat = require('./lib/get-stat.js')
const cacheTransform = require('./lib/cache-transform.js')
const {console} = require('./lib/globals.js')
const cwd = process.cwd()
const noop = () => {}

module.exports = async (args, cb = noop) => {
  await del([cacheDir])

  const assets = [
    htmlAsset(args),
    cssAsset(args),
    jsAsset(args)
  ]

  const app = createServer(async (req, res) => {
    try {
      const srcStat = await fstat(args.src)

      const srcDir = srcStat.isDirectory() ? args.src : path.dirname(args.src)
      const srcFile = srcStat.isFile() ? args.src : path.join(args.src, 'index.html')

      const from = url.parse(req.url).pathname
      let file = path.join(cwd, srcDir, from)
      let stat = await getStat(file)

      await compression(req, res)

      if (from.endsWith('.json')) {
        if (req.method === 'POST') {
          res.statusCode = stat ? 200 : 201

          const writeStream = fs.createWriteStream(file)

          req.pipe(writeStream)

          await finished(writeStream)

          return
        }

        if (req.method === 'DELETE') {
          res.statusCode = 200

          await unlink(file)

          return
        }
      }

      if (req.method !== 'GET') {
        res.statusCode = 405

        res.end('')

        return
      }

      if (!stat) {
        file = path.join(cwd, from)

        stat = await getStat(file)

        if (!stat) {
          if (accepts(req).type(['txt', 'html']) === 'html') {
            file = path.join(cwd, srcFile)

            stat = await getStat(file)
          }

          if (!stat) {
            res.statusCode = 404

            res.end('')

            return
          }
        }
      }

      const etag = `W/"${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}"`

      if (req.headers['if-none-match'] === etag) {
        res.statusCode = 304

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

      res.statusCode = 200

      res.setHeader('etag', etag)

      res.setHeader('content-type', mime.contentType(path.extname(file)))

      readStream.pipe(res)
    } catch (err) {
      error(err)

      res.statusCode = 500

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
