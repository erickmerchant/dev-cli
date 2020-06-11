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
const jsAsset = require('./lib/js-asset.js')
const getStat = require('./lib/get-stat.js')
const {console} = require('./lib/globals.js')

module.exports = async (args) => {
  const {find, list} = await import('./lib/resolver.mjs')
  const assets = [htmlAsset(args), jsAsset(args)]

  const files = await globby([path.join(args.src, '**/*')])

  const copied = []
  const cacheFile = async (relative) => {
    if (copied.includes(relative)) return

    copied.push(relative)

    const newPath = path.join(args.dist, relative)

    const file = find(relative, args.src)

    const stat = await getStat(file)

    if (!stat) {
      return
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

    if (asset != null) {
      result = await asset.transform(`/${relative}`, result)
    }

    await mkdir(path.dirname(newPath), {recursive: true})

    const stream = createWriteStream(newPath)

    stream.end(result)

    await Promise.all([
      finished(stream).then(() => {
        console.log(`${gray('[dev]')} copied ${relative}`)
      })
    ])
  }

  await Promise.all(
    files.map((file) => cacheFile(path.relative(args.src, file)))
  )

  await Promise.all(list().map((file) => cacheFile(file)))
}
