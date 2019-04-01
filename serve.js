const http2 = require('http2')
const createSecureServer = http2.createSecureServer
const {
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_CONTENT_TYPE
} = http2.constants
const mime = require('mime-types')
const accepts = require('accepts')
const {gray} = require('kleur')
const path = require('path')
const url = require('url')
const fs = require('fs')
const streamPromise = require('stream-to-promise')
const toReadableStream = require('to-readable-stream')
const del = require('del')
const makeDir = require('make-dir')
const cacheDir = require('find-cache-dir')({name: 'dev'}) || '.cache'
const htmlAsset = require('./src/html-asset.js')
const cssAsset = require('./src/css-asset.js')
const jsAsset = require('./src/js-asset.js')
const getStat = require('./src/get-stat.js')
const cwd = process.cwd()
const noop = () => {}

module.exports = ({console}) => async (args, cb = noop) => {
  await del([cacheDir])

  const assets = [
    htmlAsset(args),
    cssAsset(args),
    jsAsset(args)
  ]
  const referers = {}
  const dependencies = []

  const app = createSecureServer({
    key: fs.readFileSync(path.join(__dirname, './storage/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, './storage/cert.pem'))
  })

  const error = (err) => {
    if (!['ERR_HTTP2_STREAM_ERROR', 'ERR_HTTP2_INVALID_STREAM'].includes(err.code)) {
      console.log(err)
    }
  }

  const respond = async (pathname, prefersHTML, ifNoneMatch) => {
    const result = {}

    try {
      let file = path.join(cwd, args.src, pathname)
      let stat = await getStat(file)

      if (!stat && dependencies.includes(pathname)) {
        file = path.join(cwd, pathname)

        stat = await getStat(file)
      }

      if (!stat && prefersHTML) {
        file = path.join(cwd, args.src, 'index.html')

        stat = await getStat(file)
      }

      if (!stat) {
        result.statusCode = 404

        return result
      }

      const etag = `W/"${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}"`

      if (ifNoneMatch === etag) {
        result.statusCode = 304

        return result
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
        const source = await streamPromise(stream)

        const cacheFile = `${pathname}/${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}`
        const cacheFull = path.join(cacheDir, cacheFile)
        const cacheExists = await getStat(cacheFull)

        if (cacheExists) {
          stream = fs.createReadStream(cacheFull)
        } else {
          const transformed = await transform(pathname, source)

          const filtered = transformed.dependencies.filter((dep) => !dependencies.includes(dep))

          if (filtered.length) {
            dependencies.push(...filtered)
          }

          await makeDir(path.dirname(cacheFull))

          const writeStream = fs.createWriteStream(cacheFull)

          writeStream.end(transformed.code)

          await streamPromise(writeStream)

          stream = toReadableStream(transformed.code)
        }
      }

      result.statusCode = 200

      result.headers = {
        etag,
        [HTTP2_HEADER_CONTENT_TYPE]: mime.contentType(path.extname(file))
      }

      result.stream = stream
    } catch (err) {
      error(err)

      result.statusCode = 500
    }

    return result
  }

  const push = (pathname, res) => {
    if (referers[pathname] == null) return

    for (const path of referers[pathname]) {
      if (!res.stream.pushAllowed) continue

      res.stream.pushStream({[HTTP2_HEADER_PATH]: path}, async (err, stream) => {
        if (err) {
          error(err)

          return
        }

        stream.on('error', (err) => {
          error(err)
        })

        const result = await respond(path, false)

        if (!stream.destroyed) {
          stream.respond({[HTTP2_HEADER_STATUS]: result.statusCode, ...result.headers})

          if (result.stream) result.stream.pipe(stream)
          else {
            stream.end()
          }
        }
      })

      push(path, res)
    }
  }

  app.on('error', (err) => error(err))

  app.on('request', async (req, res) => {
    const pathname = url.parse(req.url).pathname
    const prefersHTML = accepts(req).type(['txt', 'html']) === 'html'
    const ifNoneMatch = req.headers['if-none-match']

    if (req.headers.referer != null) {
      const referer = url.parse(req.headers.referer).pathname

      if (referers[referer] == null) {
        referers[referer] = []
      }

      referers[referer].push(pathname)
    }

    const result = await respond(pathname, prefersHTML, ifNoneMatch)

    if (!res.destroyed) {
      res.writeHead(result.statusCode, result.headers)

      if (result.stream) {
        result.stream.pipe(res)

        push(pathname, res)
      } else {
        res.end()
      }
    }
  })

  app.listen(args.port, (err) => {
    if (err) {
      error(err)
    } else {
      console.log(`${gray('[dev]')} go to https://localhost:${args.port}`)
    }

    cb(err, app)
  })
}
