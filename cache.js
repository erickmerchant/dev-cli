import {createWriteStream} from 'fs'
import fs from 'fs/promises'
import {gray} from 'kleur/colors'
import path from 'path'
import stream from 'stream'
import {promisify} from 'util'

import {jsAsset} from './lib/js-asset.js'
import {find, resolved} from './lib/resolver.js'

const finished = promisify(stream.finished)

export const cache = async (args) => {
  const globFiles = async (dir, files) => {
    const all = await fs.readdir(dir, {withFileTypes: true})
    const subs = []

    for (const file of all) {
      const full = path.join(dir, file.name)

      if (file.isDirectory()) {
        subs.push(globFiles(full, files))
      } else if (file.isFile()) {
        files.push(full)
      }
    }

    await Promise.all(subs)
  }

  for (const dir of args.src) {
    const files = []

    await globFiles(dir, files)

    const copied = []
    const cacheFile = async (relative) => {
      if (copied.includes(relative)) return

      copied.push(relative)

      const newPath = path.join(args.dist, relative)

      const found = await find(relative, args.src)

      if (!found.pathname) {
        return
      }

      let code = await fs.readFile(found.pathname)

      let transform = false

      if (jsAsset.extensions.includes(path.extname(found.pathname))) {
        transform = true
      }

      if (transform) {
        code = await jsAsset.transform(
          String(code),
          new URL(relative, 'http://localhost'),
          args
        )
      }

      await fs.mkdir(path.dirname(newPath), {recursive: true})

      const stream = createWriteStream(newPath)

      stream.end(code)

      await Promise.all([
        finished(stream).then(() => {
          console.log(
            `${gray('[dev]')} copied ${
              relative.startsWith('/') ? relative : `/${relative}`
            }`
          )
        })
      ])

      await Promise.all(resolved.map((file) => cacheFile(file)))
    }

    await Promise.all(files.map((file) => cacheFile(path.relative(dir, file))))
  }
}
