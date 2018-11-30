const polka = require('polka')
const sirv = require('sirv')
const compression = require('compression')
const chalk = require('chalk')
const path = require('path')
const getStream = require('get-stream')
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
      async transform (req, code) {
        const result = await babelTransform(code, {
          sourceType: 'module',
          sourceMaps: args.dev ? 'inline' : false,
          sourceFileName: req.path,
          presets: [
            [babelPresetEnv, { modules: false }],
            babelPresetMinify
          ],
          plugins: [
            () => ({
              visitor: {
                CallExpression (path) {
                  if (path.node.callee.type !== 'Import') {
                    return
                  }

                  const [source] = path.node.arguments
                  if (source.type !== 'StringLiteral') {
                    return
                  }

                  const value = source.value

                  if (!value.startsWith('.') && !value.startsWith('/')) {
                    source.value = getImportPath(resolve.sync(value, { browser: 'module' }) || resolve.sync(value), args.src)
                  }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration' (path) {
                  const { source } = path.node

                  if (source === null) {
                    return
                  }

                  const value = source.value

                  if (!value.startsWith('.') && !value.startsWith('/')) {
                    source.value = getImportPath(resolve.sync(value, { browser: 'module' }) || resolve.sync(value), args.src)
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
      async transform (req, code) {
        const result = await postcss([
          postcssPresetEnv(),
          cssnano({ preset: 'default' }),
          (root, result) => {
            root.walkAtRules((rule, b) => {
              if (rule.name === 'import') {
                const parsed = valueParser(rule.params)

                const value = parsed.nodes[0].value

                if (!value.startsWith('.') && !value.startsWith('/')) {
                  const resolved = resolve.sync(value, { browser: 'style' }) || resolve.sync(value)

                  if (resolved.endsWith('.css')) {
                    parsed.nodes[0].value = getImportPath(resolved, args.src)

                    rule.params = String(parsed)
                  }
                }
              }
            })
          }
        ]).process(code, {
          from: req.path,
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
      const file = path.join(cwd, args.src, 'index.html')

      if (fs.existsSync(file)) {
        res.writeHead(200, { 'content-type': 'text/html' })

        createReadStream(file, 'utf8').pipe(res)
      } else {
        res.statusCode = 404

        res.end('')
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
            const code = await getStream(stream)
            const stats = fs.statSync(file)
            const etag = `W/"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`

            if (req.headers['if-none-match'] !== etag) {
              let result

              result = await transform(req, code)

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

function getImportPath (resolved, directory) {
  let result = resolved

  directory = path.join(cwd, directory)

  if (result.startsWith(directory)) {
    result = result.substring(directory.length)
  } else if (result.startsWith(cwd)) {
    result = result.substring(cwd.length)
  }

  return result
}
