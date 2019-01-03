const path = require('path')
const kleur = require('kleur')
const fs = require('fs')
const promisify = require('util').promisify
const makeDir = require('make-dir')
const globby = require('globby')
const streamPromise = require('stream-to-promise')
const createWriteStream = fs.createWriteStream
const readFile = promisify(fs.readFile)
const jsAsset = require('./js-asset.js')
const cssAsset = require('./css-asset.js')
const cwd = process.cwd()

module.exports = (deps) => async (args) => {
  const assets = [
    jsAsset(args),
    cssAsset(args)
  ]

  let files = await globby([path.join(args.src, '**/*')], {dot: true})

  const copied = []
  const cacheFile = async (relative) => {
    if (copied.includes(relative)) return

    copied.push(relative)

    const newPath = path.join(args.dist, relative)

    let file = path.join(cwd, args.src, relative)
    let exists = fs.existsSync(file)

    if (!exists) {
      file = path.join(cwd, relative)

      exists = fs.existsSync(file)
    }

    if (!exists) {
      return
    }

    let result = await readFile(file)
    const asset = assets.find((a) => a.extensions.includes(path.extname(relative)))

    if (asset != null) {
      result = await asset.transform(`/${relative}`, result)
    }

    await makeDir(path.dirname(newPath))

    const stream = createWriteStream(newPath)
    let dependencies = []

    for (const asset of assets) {
      if (asset.extensions.includes(path.extname(relative))) {
        dependencies = dependencies.concat(asset.detect(result)
          .map((file) => {
            if (file.startsWith('/')) return file.substring(1)

            return path.join(path.dirname(relative), file)
          }))
      }
    }

    stream.end(result)

    await Promise.all([streamPromise(stream).then(() => {
      deps.out.write(`${kleur.gray('[dev]')} copied ${relative}\n`)
    }), ...dependencies.map(cacheFile)])
  }

  files = files.map((file) => path.relative(args.src, file))

  await Promise.all(files.map(cacheFile))
}
