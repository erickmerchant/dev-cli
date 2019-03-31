const path = require('path')
const {gray} = require('kleur')
const fs = require('fs')
const promisify = require('util').promisify
const makeDir = require('make-dir')
const globby = require('globby')
const streamPromise = require('stream-to-promise')
const createWriteStream = fs.createWriteStream
const readFile = promisify(fs.readFile)
const htmlAsset = require('./src/html-asset.js')
const cssAsset = require('./src/css-asset.js')
const jsAsset = require('./src/js-asset.js')
const getStat = require('./src/get-stat.js')
const cwd = process.cwd()

module.exports = ({console}) => async (args) => {
  const assets = [
    htmlAsset(args),
    cssAsset(args),
    jsAsset(args)
  ]

  let files = await globby([path.join(args.src, '**/*')], {dot: true})

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

    let result = await readFile(file)
    const asset = assets.find((a) => a.extensions.includes(path.extname(relative)))
    let dependencies = []

    if (asset != null) {
      const transformed = await asset.transform(`/${relative}`, result)

      dependencies = transformed.dependencies
        .map((file) => {
          if (file.startsWith('/')) return file.substring(1)

          return path.join(path.dirname(relative), file)
        })

      result = transformed.code
    }

    await makeDir(path.dirname(newPath))

    const stream = createWriteStream(newPath)
    const promises = []

    await Promise.all(promises)

    stream.end(result)

    await Promise.all([
      streamPromise(stream).then(() => {
        console.log(`${gray('[dev]')} copied ${relative}`)
      }),
      ...dependencies.map(cacheFile)
    ])
  }

  files = files.map((file) => path.relative(args.src, file))

  await Promise.all(files.map(cacheFile))
}
