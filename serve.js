const polka = require('polka')
const sirv = require('sirv')
const compression = require('compression')
const chalk = require('chalk')
const revHash = require('rev-hash')
const findCacheDir = require('find-cache-dir')
const path = require('path')
const assert = require('assert')
const error = require('sergeant/error')
const promisify = require('util').promisify
const del = require('del')
const fs = require('fs')
const resolve = require('browser-resolve')
const babel = require('@babel/core')
const babelPresetEnv = require('@babel/preset-env')
const babelPresetMinify = require('babel-preset-minify')
const cssnano = require('cssnano')
const postcss = require('postcss')
const valueParser = require('postcss-value-parser')
const postcssPresetEnv = require('postcss-preset-env')
const access = promisify(fs.access)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const babelTransform = promisify(babel.transform)
const createReadStream = fs.createReadStream
const moduleMap = {}
const getCachePath = findCacheDir({ name: '@erickmerchant/dev-cli', thunk: true, create: true })

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  return async (args, cb = () => {}) => {
    await del(getCachePath('*'))

    const app = polka({
      onError
    })

    app.use(compression())

    app.use(getAssetMiddleware({
      directory: args.directory,
      extensions: ['.mjs', '.js'],
      contentType: 'application/javascript',
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
                    /* Should never happen */
                    return
                  }

                  const value = source.value

                  if (!value.startsWith('.') && !value.startsWith('/')) {
                    source.value = getImportPath(resolve.sync(value, { browser: 'module' }) || resolve.sync(value), args.directory)
                  }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration' (path) {
                  const { source } = path.node

                  // An export without a 'from' clause
                  if (source === null) {
                    return
                  }

                  const value = source.value

                  if (!value.startsWith('.') && !value.startsWith('/')) {
                    source.value = getImportPath(resolve.sync(value, { browser: 'module' }) || resolve.sync(value), args.directory)
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
      directory: args.directory,
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
                  let resolved = resolve.sync(value, { browser: 'style' }) || resolve.sync(value)

                  if (resolved.endsWith('.css')) {
                    parsed.nodes[0].value = getImportPath(resolved, args.directory)

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

    app.use(sirv(args.directory, {
      etag: true,
      dev: args.dev
    }))

    app.use(async (req, res, next) => {
      try {
        const file = path.join(args.directory, 'index.html')

        await access(file, fs.constants.R_OK)

        res.writeHead(200, { 'content-type': 'text/html' })

        createReadStream(file, 'utf8').pipe(res)
      } catch (err) {
        onError(err, req, res)
      }
    })

    app.listen(args.port, (err) => {
      if (err) {
        error(err)

        cb(err)
      } else {
        deps.out.write(`${chalk.gray('[dev]')} server is listening at port ${args.port}\n`)

        cb(null, app)
      }
    })
  }
}

function onError (err, req, res) {
  error(err)

  res.writeHead(500, { 'content-type': 'text/plain' })

  res.end('')
}

function getAssetMiddleware ({ directory, extensions, contentType, transform }) {
  return async (req, res, next) => {
    if (extensions.includes(path.extname(req.path))) {
      try {
        res.writeHead(200, { 'content-type': contentType })

        let file

        if (moduleMap[req.path] != null) {
          file = path.join(directory, moduleMap[req.path])
        } else {
          file = path.join(directory, req.path)
        }

        await access(file, fs.constants.R_OK)

        const code = await readFile(file, 'utf8')
        const cachePath = getCachePath(revHash(code))
        let result

        if (!fs.existsSync(cachePath)) {
          result = await transform(req, code)

          await writeFile(cachePath, result)
        } else {
          result = await readFile(cachePath, 'utf8')
        }

        res.end(result)
      } catch (err) {
        onError(err, req, res)
      }
    } else {
      next()
    }
  }
}

function getImportPath (resolved, directory) {
  const result = path.relative(path.resolve(directory), resolved)
  const preExisting = Object.keys(moduleMap).find((id) => moduleMap[id] === result)

  if (preExisting) {
    return preExisting
  }

  let id = result

  while (id.startsWith('.') || id.startsWith('/')) {
    id = id.substring(1)
  }

  id = `/${id}`

  moduleMap[id] = result

  return id
}
