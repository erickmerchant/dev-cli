const polka = require('polka')
const mime = require('mime/lite')
const compression = require('compression')
const {gray} = require('kleur')
const path = require('path')
const streamPromise = require('stream-to-promise')
const assert = require('assert')
const error = require('sergeant/error')
const fs = require('fs')
const promisify = require('util').promisify
const fstat = promisify(fs.stat)
const fexists = promisify(fs.exists)
const del = require('del')
const cacheDir = require('find-cache-dir')({name: 'dev'})
const jsAsset = require('./src/js-asset.js')
const cssAsset = require('./src/css-asset.js')
const cacheTransform = require('./src/cache-transform.js')
const cwd = process.cwd()
const noop = () => {}

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  const safeMiddleware = (middleware) => async (req, res, next) => {
    try {
      await middleware(req, res, next)
    } catch (err) {
      next(err)
    }
  }

  const getAssetMiddleware = ({src, extensions, contentType, transform}) => async (req, res, next) => {
    if (!extensions.includes(path.extname(req.path))) {
      return next()
    }

    let file = path.join(cwd, src, req.path)
    let exists = await fexists(file)

    if (!exists) {
      file = path.join(cwd, req.path)

      exists = await fexists(file)
    }

    if (!exists) {
      res.statusCode = 404

      return res.end('')
    }

    const stream = fs.createReadStream(file)
    const code = await streamPromise(stream)
    const stats = await fstat(file)
    const etag = `W/"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`

    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304

      return res.end('')
    }

    const result = await cacheTransform(cacheDir, transform)(req.path, code)

    res.writeHead(200, {
      etag,
      'content-type': contentType
    })

    res.end(result)
  }

  return async (args, cb = noop) => {
    if (cacheDir == null) {
      throw new Error('cache directory not found')
    }

    await del([cacheDir])

    const app = polka({
      onError(err, req, res) {
        error(err)

        res.statusCode = 500

        res.end('')
      }
    })

    app.use(compression())

    app.use(safeMiddleware(getAssetMiddleware(cssAsset(args))))

    app.use(safeMiddleware(getAssetMiddleware(jsAsset(args))))

    app.use(safeMiddleware(async (req, res, next) => {
      const file = path.join(cwd, args.src, req.path)
      const exists = await fexists(file)

      if (!exists) {
        return next()
      }

      const stats = await fstat(file)

      if (!stats.isFile()) {
        return next()
      }

      const etag = `W/"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`

      if (req.headers['if-none-match'] === etag) {
        res.statusCode = 304

        return res.end('')
      }

      res.writeHead(200, {
        etag,
        'content-type': mime.getType(path.extname(req.path))
      })

      fs.createReadStream(file).pipe(res)
    }))

    app.use(safeMiddleware(async (req, res, next) => {
      const file = path.join(cwd, args.src, 'index.html')
      const exists = await fexists(file)

      if (!exists) {
        res.statusCode = 404

        return res.end('')
      }

      const stats = await fstat(file)
      const etag = `W/"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`

      if (req.headers['if-none-match'] === etag) {
        res.statusCode = 304

        return res.end('')
      }

      res.writeHead(200, {
        etag,
        'content-type': 'text/html'
      })

      fs.createReadStream(file).pipe(res)
    }))

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
