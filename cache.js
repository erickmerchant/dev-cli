import fs from 'fs'
import path from 'path'
import {gray} from 'sergeant'
import stream from 'stream'
import {promisify} from 'util'

import {jsAsset} from './lib/js-asset.js'
import {find} from './lib/resolver.js'

const finished = promisify(stream.finished)
const createWriteStream = fs.createWriteStream
const mkdir = promisify(fs.mkdir)
const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

export const cache = async (args) => {
  const globFiles = async (dir, files) => {
    const all = await readdir(dir, {withFileTypes: true})
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

      const meta = await find(relative, args.src)

      meta.args = args

      meta.resolved = []

      if (!meta.pathname) {
        return
      }

      let code = await readFile(meta.pathname, 'utf8')

      let transform = false

      if (jsAsset.extensions.includes(path.extname(meta.pathname))) {
        transform = true
      }

      if (transform) {
        meta.entry = relative === args['--entry']

        code = await jsAsset.transform(code, meta)
      }

      await mkdir(path.dirname(newPath), {recursive: true})

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

      await Promise.all(meta.resolved.map((file) => cacheFile(file)))
    }

    await Promise.all(files.map((file) => cacheFile(path.relative(dir, file))))
  }

  const {stats, pathname} = await find(args['--template'], args.src)

  if (stats) {
    let html = await readFile(pathname, 'utf8')

    html = html.replace(
      '</body>',
      `<script type="module" src="/${args['--entry']}"></script></body>`
    )

    const stream = createWriteStream(path.join(args.dist, 'index.html'))

    stream.end(html)

    await finished(stream).then(() => {
      console.log(`${gray('[dev]')} copied /index.html`)
    })
  }
}
