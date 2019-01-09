const polka = require('polka')
const sirv = require('sirv')
const compression = require('compression')
const {gray} = require('kleur')
const path = require('path')
const streamPromise = require('stream-to-promise')
const assert = require('assert')
const error = require('sergeant/error')
const fs = require('fs')
const jsAsset = require('./js-asset.js')
const cssAsset = require('./css-asset.js')
const createReadStream = fs.createReadStream
const cwd = process.cwd()
const noop = () => {}

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  const getAssetMiddleware = ({src, extensions, contentType, transform}) => async (req, res, next) => {
    try {
      if (extensions.includes(path.extname(req.path))) {
        let file = path.join(cwd, src, req.path)
        let exists = fs.existsSync(file)

        if (!exists) {
          file = path.join(cwd, req.path)

          exists = fs.existsSync(file)
        }

        if (exists) {
          const stream = await createReadStream(file)
          const code = await streamPromise(stream)
          const stats = fs.statSync(file)
          const etag = `W/"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`

          if (req.headers['if-none-match'] !== etag) {
            const result = await transform(req.path, code)

            res.writeHead(200, {
              etag,
              'content-type': contentType
            })

            res.end(result)
          } else {
            res.statusCode = 304

            res.end('')
          }
        } else {
          res.statusCode = 404

          res.end('')
        }
      } else {
        next()
      }
    } catch (err) {
      next(err)
    }
  }

  return (args, cb = noop) => {
    const app = polka({
      onError(err, req, res) {
        error(err)

        res.statusCode = 500

        res.end('')
      }
    })

    app.use(compression())

    app.use(getAssetMiddleware(cssAsset(args)))

    app.use(getAssetMiddleware(jsAsset(args)))

    app.use(sirv(args.src, {
      etag: true,
      dev: args.dev
    }))

    app.use(async (req, res, next) => {
      const file = path.join(cwd, args.src, 'index.html')

      if (fs.existsSync(file)) {
        res.writeHead(200, {'content-type': 'text/html'})

        createReadStream(file).pipe(res)
      } else {
        res.statusCode = 404

        res.end('')
      }
    })

    app.listen(args.port, (err) => {
      if (err) {
        error(err)
      } else {
        deps.out.write(`${gray('[dev]')} server is listening at port ${args.port}\n`)
      }

      cb(err, app)
    })
  }
}
