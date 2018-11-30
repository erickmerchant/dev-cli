const path = require('path')
const fs = require('fs')
const makeDir = require('make-dir')
const globby = require('globby')
const got = require('got')
const streamPromise = require('stream-to-promise')
const serve = require('./serve.js')
const detectives = [
  {
    extensions: ['.css'],
    detect: require('detective-postcss')
  },
  {
    extensions: ['.mjs', '.js'],
    detect: require('detective-es6')
  }
]
const createWriteStream = fs.createWriteStream

module.exports = (deps) => {
  return async (args) => {
    serve(deps)(args, async (err, app) => {
      if (err) {
        return
      }

      let files = await globby([path.join(args.src, '**/*')])

      files = files.map((file) => path.relative(args.src, file))

      await Promise.all(files.map(cacheFile))

      app.server.close()

      async function cacheFile (relative) {
        const newPath = path.join(args.dist, relative)

        const result = await got(`http://localhost:${args.port}/${relative}`)

        await makeDir(path.dirname(newPath))

        const stream = createWriteStream(newPath)
        let deps = []

        for (const detective of detectives) {
          if (detective.extensions.includes(path.extname(relative))) {
            deps = deps.concat(detective.detect(result.body)
              .map((file) => {
                if (file.startsWith('/')) return file.substring(1)

                return path.join(path.dirname(relative), file)
              })
              .filter((file) => !files.includes(file)))
          }
        }

        stream.end(result.body)

        await Promise.all([streamPromise(stream), ...deps.map(cacheFile)])
      }
    })
  }
}
