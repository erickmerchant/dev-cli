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
const streamToPromise = require('stream-to-promise')
const del = require('del')
const cacheDir = require('find-cache-dir')({name: 'dev'}) || '.cache'
const htmlAsset = require('./src/html-asset.js')
const cssAsset = require('./src/css-asset.js')
const jsAsset = require('./src/js-asset.js')
const getStat = require('./src/get-stat.js')
const cacheTransform = require('./src/cache-transform.js')
const cwd = process.cwd()
const noop = () => {}

module.exports = ({console}) => async (args, cb = noop) => {
  await del([cacheDir])

  const assets = [
    htmlAsset(args),
    cssAsset(args),
    jsAsset(args)
  ]

  const app = createServer(async (req, res) => {
    try {
      const from = url.parse(req.url).pathname

      await compression(req, res)

      let file = path.join(cwd, args.src, from)
      let stat = await getStat(file)

      if (!stat) {
        file = path.join(cwd, from)

        stat = await getStat(file)

        if (!stat) {
          if (accepts(req).type(['txt', 'html']) === 'html') {
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
      let transform

      for (const asset of assets) {
        if (asset.extensions.includes(path.extname(file))) {
          transform = asset.transform

          break
        }
      }

      if (transform) {
        const code = await streamToPromise(stream)

        stream = await cacheTransform({cacheDir, transform, code, from})
      }

      res.writeHead(200, {
        etag,
        'content-type': mime.contentType(path.extname(file))
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
