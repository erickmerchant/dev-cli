const path = require('path')
const {gray} = require('kleur')
const {promisify} = require('util')
const fs = require('fs')
const globby = require('globby')
const stream = require('stream')
const finished = promisify(stream.finished)
const createWriteStream = fs.createWriteStream
const createReadStream = fs.createReadStream
const mkdir = promisify(fs.mkdir)
const htmlAsset = require('./lib/html-asset.js')
const cssAsset = require('./lib/css-asset.js')
const jsAsset = require('./lib/js-asset.js')
const getStat = require('./lib/get-stat.js')
const {console} = require('./lib/globals.js')
const getResolver = require('./lib/get-resolver.js')
const cwd = process.cwd()

module.exports = async (args) => {
  const resolver = await getResolver(args.importmap)

  const assets = [
    htmlAsset(args, resolver),
    cssAsset(args, resolver),
    jsAsset(args, resolver)
  ]

  const files = await globby([path.join(args.src, '**/*')])

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

    const resultStream = createReadStream(file)

    let result = []

    for await (const chunk of resultStream) {
      result.push(chunk)
    }

    result = Buffer.concat(result)

    const asset = assets.find((a) =>
      a.extensions.includes(path.extname(relative))
    )
    let dependencies = []

    if (asset != null) {
      result = await asset.transform(`/${relative}`, result, dependencies)
    }

    dependencies = dependencies.map((file) => {
      if (file.startsWith('/')) return file.substring(1)

      return path.join(path.dirname(relative), file)
    })

    await mkdir(path.dirname(newPath), {recursive: true})

    const stream = createWriteStream(newPath)

    stream.end(result)

    await Promise.all([
      finished(stream).then(() => {
        console.log(`${gray('[dev]')} copied ${relative}`)
      }),
      ...dependencies.map(cacheFile)
    ])
  }

  await Promise.all(
    files.map((file) => cacheFile(path.relative(args.src, file)))
  )
}
