const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const streamToPromise = require('stream-to-promise')
const toReadableStream = require('to-readable-stream')
const makeDir = require('make-dir')
const getStat = require('./get-stat.js')

module.exports = async ({cacheDir, transform, code, pathname}) => {
  const hash = crypto.createHash('md5').update(code).digest('hex')
  const cacheFile = path.join(cacheDir, hash)
  const stat = await getStat(cacheFile)

  if (stat) {
    const stream = fs.createReadStream(cacheFile)

    return stream
  }

  const result = await transform(pathname, code)

  await makeDir(path.dirname(cacheFile))

  const stream = fs.createWriteStream(cacheFile)

  stream.end(result)

  await streamToPromise(stream)

  return toReadableStream(result)
}
