import crypto from 'crypto'
import path from 'path'
import {promisify} from 'util'
import stream from 'stream'
import fs from 'fs'
import getStat from './get-stat.js'

const mkdir = promisify(fs.mkdir)
const finished = promisify(stream.finished)
const Readable = stream.Readable

export default async ({cacheDir, transform, code, from}) => {
  const hash = crypto.createHash('md5').update(code).digest('hex')
  const cacheFile = path.join(cacheDir, hash)
  const stat = await getStat(cacheFile)

  if (stat) {
    const stream = fs.createReadStream(cacheFile)

    return stream
  }

  const result = await transform(from, code)

  await mkdir(path.dirname(cacheFile), {recursive: true})

  const stream = fs.createWriteStream(cacheFile)

  stream.end(result)

  await finished(stream)

  return Readable.from(result)
}
