const createServer = require('http').createServer
const mime = require('mime/lite')
const promisify = require('util').promisify
const compression = promisify(require('compression')())
const {gray} = require('kleur')
const path = require('path')
const url = require('url')
const error = require('sergeant/error')
const fs = require('fs')
const streamToPromise = require('stream-to-promise')
const del = require('del')
const cacheDir = require('find-cache-dir')({name: 'dev'})
const cssAsset = require('./src/css-asset.js')
const jsAsset = require('./src/js-asset.js')
const getStat = require('./src/get-stat.js')
const cacheTransform = require('./src/cache-transform.js')
const cwd = process.cwd()
const noop = () => {}

module.exports = ({console}) => async (args, cb = noop) => {
  if (cacheDir == null) {
    throw new Error('cache directory not found')
  }

  await del([cacheDir])

  const assets = [
    cssAsset(args),
    jsAsset(args)
  ]

  const app = createServer(async (req, res) => {
    try {
      const pathname = url.parse(req.url).pathname

      await compression(req, res)

      let transform = false

      for (const asset of assets) {
        if (asset.extensions.includes(path.extname(pathname))) {
          transform = asset.transform

          break
        }
      }

      let file = path.join(cwd, args.src, pathname)
      let stat = await getStat(file)

      if (!stat) {
        file = path.join(cwd, pathname)

        stat = await getStat(file)

        if (!stat) {
          if (!transform) {
            file = path.join(cwd, args.src, 'index.html')

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

      let stream = fs.createReadStream(file)
      const from = pathname

      if (transform) {
        const code = await streamToPromise(stream)

        stream = await cacheTransform({cacheDir, transform, code, from})
      }

      res.writeHead(200, {
        etag,
        'content-type': mime.getType(path.extname(file))
      })

      stream.pipe(res)
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
      console.log(`${gray('[dev]')} server is listening at port ${args.port}`)
    }

    cb(err, app)
  })
}
