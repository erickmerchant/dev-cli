const path = require('path')
const fs = require('fs')
const makeDir = require('make-dir')
const globby = require('globby')
const got = require('got')
const streamPromise = require('stream-to-promise')
const serve = require('./serve.js')
const cssDetective = require('detective-postcss')
const jsDetective = require('detective-es6')
const createWriteStream = fs.createWriteStream

module.exports = (deps) => {
  return async (args) => {
    serve(deps)(args, async (err, app) => {
      if (err) {
        return
      }

      let files = await globby([path.join(args.src, '**/*')])
      let deps = []

      files = files.map((file) => path.relative(args.src, file))

      await Promise.all(files.map(cacheFile))

      await Promise.all(deps.map(cacheFile))

      app.server.close()

      async function cacheFile (relative) {
        const newPath = path.join(args.dist, relative)

        const result = await got(`http://localhost:${args.port}/${relative}`)

        await makeDir(path.dirname(newPath))

        const stream = createWriteStream(newPath)

        if (['.mjs', '.js'].includes(path.extname(relative))) {
          gatherDeps(jsDetective(result.body), relative)
        }

        if (['.css'].includes(path.extname(relative))) {
          gatherDeps(cssDetective(result.body), relative)
        }

        stream.end(result.body)

        await streamPromise(stream)
      }

      function gatherDeps (detected, relative) {
        deps = deps.concat(detected.map((file) => {
          if (file.startsWith('/')) return file.substring(1)

          return path.join(path.dirname(relative), file)
        }).filter((file) => !deps.includes(file) && !files.includes(path.join(args.src, file))))
      }
    })
  }
}
