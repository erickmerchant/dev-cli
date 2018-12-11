const polka = require('polka')
const sirv = require('sirv')
const compression = require('compression')
const chalk = require('chalk')
const path = require('path')
const streamPromise = require('stream-to-promise')
const assert = require('assert')
const error = require('sergeant/error')
const promisify = require('util').promisify
const fs = require('fs')
const resolve = require('browser-resolve')
const babel = require('@babel/core')
const babelPresetEnv = require('@babel/preset-env')
const babelPresetMinify = require('babel-preset-minify')
const cssnano = require('cssnano')
const postcss = require('postcss')
const valueParser = require('postcss-value-parser')
const postcssPresetEnv = require('postcss-preset-env')
const babelTransform = promisify(babel.transform)
const createReadStream = fs.createReadStream
const cwd = process.cwd()
const noop = () => {}

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  return (args, cb = noop) => {
    const app = polka({
      onError (err, req, res) {
        error(err)

        res.statusCode = 500

        res.end('')
      }
    })

    app.use(compression())

    app.use(getAssetMiddleware({
      src: args.src,
      extensions: ['.mjs', '.js'],
      contentType: 'text/javascript',
      async transform (from, code) {
        const result = await babelTransform(code, {
          sourceType: 'module',
          sourceMaps: args.dev ? 'inline' : false,
          sourceFileName: from,
          presets: [
            [babelPresetEnv, { modules: false }],
            babelPresetMinify
          ],
          plugins: [
            () => ({
              visitor: {
                CallExpression ({ node }) {
                  const [source] = node.arguments

                  if (node.callee.type === 'Import' && source.type === 'StringLiteral') {
                    const value = source.value

                    if (isBare(value)) {
                      source.value = getImportPath(value, 'module')
                    }
                  }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration' ({ node }) {
                  if (node.source != null) {
                    const value = node.source.value

                    if (isBare(value)) {
                      node.source.value = getImportPath(value, 'module')
                    }
                  }
                }
              }
            })
          ]
        })

        return result.code
      }
    }))

    app.use(getAssetMiddleware({
      src: args.src,
      extensions: ['.css'],
      contentType: 'text/css',
      async transform (from, code) {
        const result = await postcss([
          postcssPresetEnv(),
          cssnano({ preset: 'default' }),
          (root, result) => {
            root.walkAtRules((rule, b) => {
              if (rule.name === 'import') {
                const parsed = valueParser(rule.params)

                const value = parsed.nodes[0].value

                if (isBare(value)) {
                  parsed.nodes[0].value = getImportPath(value, 'style')

                  rule.params = String(parsed)
                }
              }
            })
          }
        ]).process(code, {
          from,
          map: args.dev ? { inline: true } : false
        })

        return result.css
      }
    }))

    app.use(sirv(args.src, {
      etag: true,
      dev: args.dev
    }))

    app.use(async (req, res, next) => {
      const file = path.join(cwd, args.src, req.path)

      if (!req.path.startsWith('.') && fs.existsSync(path.join(cwd, args.src, req.path))) {
        res.writeHead(200, { 'content-type': 'text/plain' })

        createReadStream(file, 'utf8').pipe(res)
      } else {
        const file = path.join(cwd, args.src, 'index.html')

        if (fs.existsSync(file)) {
          res.writeHead(200, { 'content-type': 'text/html' })

          createReadStream(file, 'utf8').pipe(res)
        } else {
          res.statusCode = 404

          res.end('')
        }
      }
    })

    app.listen(args.port, (err) => {
      if (err) {
        error(err)
      } else {
        deps.out.write(`${chalk.gray('[dev]')} server is listening at port ${args.port}\n`)
      }

      cb(err, app)
    })

    function getImportPath (value, browser) {
      const resolved = resolve.sync(value, { browser }) || resolve.sync(value)
      const directory = path.join(cwd, args.src)

      if (resolved.startsWith(directory)) {
        return resolved.substring(directory.length)
      } else if (resolved.startsWith(cwd)) {
        return resolved.substring(cwd.length)
      }

      return resolved
    }
  }

  function isBare (value) {
    return !value.startsWith('.') && !value.startsWith('/')
  }

  function getAssetMiddleware ({ src, extensions, contentType, transform }) {
    return async (req, res, next) => {
      try {
        if (extensions.includes(path.extname(req.path))) {
          let file = path.join(cwd, src, req.path)
          let exists = fs.existsSync(file)

          if (!exists) {
            file = path.join(cwd, req.path)

            exists = fs.existsSync(file)
          }

          if (exists) {
            const stream = await createReadStream(file, 'utf8')
            const code = await streamPromise(stream)
            const stats = fs.statSync(file)
            const etag = `W/"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`

            if (req.headers['if-none-match'] !== etag) {
              let result

              result = await transform(req.path, code)

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
  }
}
