const crypto = require('crypto')
const path = require('path')
const {promisify} = require('util')
const stream = require('stream')
const finished = promisify(stream.finished)
const fs = require('fs')
const mkdir = promisify(fs.mkdir)
const toReadableStream = require('to-readable-stream')
const getStat = require('./get-stat.js')

module.exports = async ({cacheDir, transform, code, from}) => {
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

  return toReadableStream(result)
}
