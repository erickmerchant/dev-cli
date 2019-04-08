const http2 = require('http2')
const createSecureServer = http2.createSecureServer
const {
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_IF_NONE_MATCH,
  HTTP2_HEADER_ETAG,
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_REFERER,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_NOT_MODIFIED,
  HTTP_STATUS_OK
} = http2.constants
const ERR_HTTP2_STREAM_ERROR = 'ERR_HTTP2_STREAM_ERROR'
const ERR_HTTP2_INVALID_STREAM = 'ERR_HTTP2_INVALID_STREAM'
const zlib = require('zlib')
const mime = require('mime-types')
const accepts = require('accepts')
const compressible = require('compressible')
const {gray} = require('kleur')
const path = require('path')
const url = require('url')
const fs = require('fs')
const streamPromise = require('stream-to-promise')
const toReadableStream = require('to-readable-stream')
const del = require('del')
const makeDir = require('make-dir')
const findCacheDir = require('find-cache-dir')
const htmlAsset = require('./src/html-asset.js')
const cssAsset = require('./src/css-asset.js')
const jsAsset = require('./src/js-asset.js')
const getStat = require('./src/get-stat.js')
const cwd = process.cwd()
const noop = () => {}

module.exports = ({console}) => async (args, cb = noop) => {
  const cacheDir = findCacheDir({name: 'dev'}) || '.cache'

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
    if (![ERR_HTTP2_STREAM_ERROR, ERR_HTTP2_INVALID_STREAM].includes(err.code)) {
      console.log(err)
    }
  }

  const encode = (stream, encoding) => {
    switch (encoding) {
      case 'br':
        stream = stream.pipe(zlib.createBrotliCompress())
        break

      case 'gzip':
        stream = stream.pipe(zlib.createGzip())
        break

      case 'deflate':
        stream = stream.pipe(zlib.createDeflate())
        break
    }

    return stream
  }

  const respond = async (pathname, req) => {
    const result = {}

    try {
      let file = path.join(cwd, args.src, pathname)
      let stat = await getStat(file)
      const reqAccepts = accepts(req)

      if (!stat && dependencies.includes(pathname)) {
        file = path.join(cwd, pathname)

        stat = await getStat(file)
      }

      if (!stat && req != null && reqAccepts.type(['txt', 'html']) === 'html') {
        file = path.join(cwd, args.src, 'index.html')

        stat = await getStat(file)
      }

      if (!stat) {
        result.statusCode = HTTP_STATUS_NOT_FOUND

        return result
      }

      const etag = `W/"${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}"`

      if (req.headers[HTTP2_HEADER_IF_NONE_MATCH] === etag) {
        result.statusCode = HTTP_STATUS_NOT_MODIFIED

        return result
      }

      const type = mime.contentType(path.extname(file))
      const encoding = compressible(type) ? reqAccepts.encoding(['br', 'gzip', 'defalt']) : false
      let transform

      for (const asset of assets) {
        if (asset.extensions.includes(path.extname(file))) {
          transform = asset.transform

          break
        }
      }

      const cacheFile = `${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}/${pathname !== '/' ? pathname : 'index.html'}${encoding ? `.${encoding}` : ''}`
      const cacheFull = path.join(cacheDir, cacheFile)
      const cacheExists = await getStat(cacheFull)
      let stream

      if (cacheExists) {
        stream = fs.createReadStream(cacheFull)
      } else {
        stream = fs.createReadStream(file)

        let source = await streamPromise(stream)

        if (transform) {
          const transformed = await transform(pathname, source)

          const filtered = transformed.dependencies.filter((dep) => !dependencies.includes(dep))

          if (filtered.length) {
            dependencies.push(...filtered)
          }

          source = transformed.code
        }

        stream = toReadableStream(source)

        stream = encode(stream, encoding)

        await makeDir(path.dirname(cacheFull))

        const writeStream = fs.createWriteStream(cacheFull)

        stream.pipe(writeStream)
      }

      result.statusCode = HTTP_STATUS_OK

      result.headers = {
        [HTTP2_HEADER_ETAG]: etag,
        [HTTP2_HEADER_CONTENT_TYPE]: type
      }

      if (encoding) {
        result.headers[HTTP2_HEADER_CONTENT_ENCODING] = encoding
      }

      result.stream = stream
    } catch (err) {
      error(err)

      result.statusCode = HTTP_STATUS_INTERNAL_SERVER_ERROR
    }

    return result
  }

  const push = (pathname, res, req) => {
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

        const result = await respond(path, req)

        if (!stream.destroyed) {
          stream.respond({
            ...result.headers,
            [HTTP2_HEADER_STATUS]: result.statusCode
          })

          if (result.stream) result.stream.pipe(stream)
          else {
            stream.end()
          }
        }
      })

      push(path, res, req)
    }
  }

  app.on('error', (err) => error(err))

  app.on('request', async (req, res) => {
    const pathname = url.parse(req.url).pathname

    if (req.headers[HTTP2_HEADER_REFERER] != null) {
      const referer = url.parse(req.headers[HTTP2_HEADER_REFERER]).pathname

      if (referers[referer] == null) {
        referers[referer] = []
      }

      referers[referer].push(pathname)
    }

    const result = await respond(pathname, req)

    if (!res.destroyed) {
      res.writeHead(result.statusCode, result.headers)

      if (result.stream) {
        result.stream.pipe(res)

        push(pathname, res, req)
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
