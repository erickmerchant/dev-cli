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
const postcssPresetEnv = require('postcss-preset-env')
const access = promisify(fs.access)
const readFile = promisify(fs.readFile)
const babelTransform = promisify(babel.transform)
const createReadStream = fs.createReadStream
const moduleMap = {}
let moduleId = 0

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  return async (args, cb = () => {}) => {
    const app = polka({
      onError
    })

    app.use(async (req, res, next) => {
      if (req.path.endsWith('.mjs')) {
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

                    if (!source.value.startsWith('.') && !source.value.startsWith('/')) {
                      source.value = getImportPath(source.value, args.directory, 'mjs')
                    }
                  },
                  'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration' (path) {
                    const { source } = path.node

                    // An export without a 'from' clause
                    if (source === null) {
                      return
                    }

                    if (!source.value.startsWith('.') && !source.value.startsWith('/')) {
                      source.value = getImportPath(source.value, args.directory, 'mjs')
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

          const file = path.join(args.directory, req.path)

          await access(file, fs.constants.R_OK)

          const code = await readFile(file, 'utf8')

          const result = await postcss([
            postcssPresetEnv(),
            postcssMinify()
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

function getImportPath (source, directory, ext) {
  const result = path.relative(path.resolve(directory), resolve.sync(source))
  const preExisting = Object.keys(moduleMap).find((id) => moduleMap[id] === result)

  if (preExisting) {
    return preExisting
  }

  const id = `/m/${moduleId++}.${ext}`

  moduleMap[id] = result

  return id
}
