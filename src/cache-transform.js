const crypto = require('crypto')
const path = require('path')
const {promisify} = require('util')
const fs = require('fs')
const mkdir = promisify(fs.mkdir)
const streamToPromise = require('stream-to-promise')
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

  await streamToPromise(stream)

  return toReadableStream(result)
}
