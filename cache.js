const path = require('path')
const {gray} = require('kleur')
const fs = require('fs')
const makeDir = require('make-dir')
const globby = require('globby')
const streamPromise = require('stream-to-promise')
const createWriteStream = fs.createWriteStream
const createReadStream = fs.createReadStream
const htmlAsset = require('./src/html-asset.js')
const cssAsset = require('./src/css-asset.js')
const jsAsset = require('./src/js-asset.js')
const getStat = require('./src/get-stat.js')
const {console} = require('./src/globals.js')
const cwd = process.cwd()

module.exports = async (args) => {
  const assets = [
    htmlAsset(args),
    cssAsset(args),
    jsAsset(args)
  ]

  const files = await globby([path.join(args.src, '**/*')], {dot: true})

  const copied = []
  const cacheFile = async (relative) => {
    if (copied.includes(relative)) return

    copied.push(relative)

    const newPath = path.join(args.dist, relative)

    let file = path.join(cwd, args.src, relative)
    let stat = await getStat(file)

    if (!stat) {
      file = path.join(cwd, relative)

      stat = await getStat(file)

      if (!stat) {
        return
      }
    }

    let result = await streamPromise(createReadStream(file, 'utf8'))

    result = String(result)

    const asset = assets.find((a) => a.extensions.includes(path.extname(relative)))

    if (asset != null) {
      result = await asset.transform(`/${relative}`, result)
    }

    await makeDir(path.dirname(newPath))

    const stream = createWriteStream(newPath)
    const dependencies = []
    const promises = []

    for (const asset of assets) {
      if (asset.extensions.includes(path.extname(relative))) {
        promises.push(asset.detect(result).then((detected) => {
          dependencies.push(...detected
            .map((file) => {
              if (file.startsWith('/')) return file.substring(1)

              return path.join(path.dirname(relative), file)
            }))
        }))
      }
    }

    await Promise.all(promises)

    stream.end(result)

    await Promise.all([
      streamPromise(stream).then(() => {
        console.log(`${gray('[dev]')} copied ${relative}`)
      }),
      ...dependencies.map(cacheFile)
    ])
  }

  await Promise.all(files.map((file) => cacheFile(path.relative(args.src, file))))
}
