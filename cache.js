import fs from 'fs'
import path from 'path'
import {gray} from 'sergeant'
import stream from 'stream'
import {promisify} from 'util'

import {getStat} from './lib/get-stat.js'
import {htmlAsset} from './lib/html-asset.js'
import {jsAsset} from './lib/js-asset.js'
import {find, list} from './lib/resolver.js'

const finished = promisify(stream.finished)
const createWriteStream = fs.createWriteStream
const mkdir = promisify(fs.mkdir)
const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

export const cache = async (args) => {
  const assets = [htmlAsset(args), jsAsset(args)]

  const files = []

  const globFiles = async (dir) => {
    const all = await readdir(dir, {withFileTypes: true})
    const subs = []

    for (const file of all) {
      const full = path.join(dir, file.name)

      if (file.isDirectory()) {
        subs.push(globFiles(full))
      } else if (file.isFile()) {
        files.push(full)
      }
    }

    await Promise.all(subs)
  }

  await globFiles(args.src)

  const copied = []
  const cacheFile = async (relative) => {
    if (copied.includes(relative)) return

    copied.push(relative)

    const newPath = path.join(args.dist, relative)

    const file = (await find(relative, [args.src]))[0]

    const stat = await getStat(file)

    if (!stat) {
      return
    }

    let result = await readFile(file)

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
        console.log(
          `${gray('[dev]')} copied ${
            relative.startsWith('/') ? relative : `/${relative}`
          }`
        )
      })
    ])

    await Promise.all(list().map((file) => cacheFile(file)))
  }

  await Promise.all(
    files.map((file) => cacheFile(path.relative(args.src, file)))
  )
}
