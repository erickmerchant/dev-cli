import path from 'path'
import {gray} from 'kleur/colors'
import {promisify} from 'util'
import fs from 'fs'
import globby from 'globby'
import stream from 'stream'
import htmlAsset from './lib/html-asset.js'
import jsAsset from './lib/js-asset.js'
import getStat from './lib/get-stat.js'

const finished = promisify(stream.finished)
const createWriteStream = fs.createWriteStream
const createReadStream = fs.createReadStream
const mkdir = promisify(fs.mkdir)

export default async (args) => {
  if (args.src == null) {
    throw Error('<src> is required')
  }

  if (args.dist == null) {
    throw Error('<dist> is required')
  }

  const {find, list} = await import('./lib/resolver.js')
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
        process.stdout.write(`${gray('[dev]')} copied ${relative}\n`)
      })
    ])
  }

  await Promise.all(
    files.map((file) => cacheFile(path.relative(args.src, file)))
  )

  await Promise.all(list().map((file) => cacheFile(file)))
}
