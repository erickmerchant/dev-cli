const polka = require('polka')
const sirv = require('sirv')
const chalk = require('chalk')
const path = require('path')
const assert = require('assert')
const error = require('sergeant/error')
const promisify = require('util').promisify
const fs = require('fs')
const resolve = require('browser-resolve')
const babel = require('@babel/core')
const babelPresetEnv = require('@babel/preset-env')
const babelMinify = require('babel-preset-minify')
const postcssMinify = require('cssnano')
const postcss = require('postcss')
const valueParser = require('postcss-value-parser')
const postcssPresetEnv = require('postcss-preset-env')
const access = promisify(fs.access)
const readFile = promisify(fs.readFile)
const babelTransform = promisify(babel.transform)
const createReadStream = fs.createReadStream
const moduleMap = {}

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  return async (args, cb = () => {}) => {
    const app = polka({
      onError
    })

    app.use(async (req, res, next) => {
      if (req.path.endsWith('.mjs') || req.path.endsWith('.js')) {
        try {
          res.writeHead(200, { 'content-type': 'application/javascript' })

          let file

          if (moduleMap[req.path] != null) {
            file = path.join(args.directory, moduleMap[req.path])
          } else {
            file = path.join(args.directory, req.path)
          }

          await access(file, fs.constants.R_OK)

          const code = await readFile(file, 'utf8')

          const result = await babelTransform(code, {
            sourceType: 'module',
            sourceMaps: 'inline',
            sourceFileName: req.path,
            presets: [
              [babelPresetEnv, { modules: false }],
              babelMinify
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

          res.end(result.code)
        } catch (err) {
          onError(err, req, res)
        }
      } else {
        next()
      }
    })

    app.use(async (req, res, next) => {
      if (req.path.endsWith('.css')) {
        try {
          res.writeHead(200, { 'content-type': 'text/css' })

          let file

          if (moduleMap[req.path] != null) {
            file = path.join(args.directory, moduleMap[req.path])
          } else {
            file = path.join(args.directory, req.path)
          }

          await access(file, fs.constants.R_OK)

          const code = await readFile(file, 'utf8')

          const result = await postcss([
            postcssPresetEnv(),
            postcssMinify(),
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
            map: { inline: true }
          })

          res.end(result.css)
        } catch (err) {
          onError(err, req, res)
        }
      } else {
        next()
      }
    })

    app.use(sirv(args.directory, {
      etag: true,
      dev: true
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
