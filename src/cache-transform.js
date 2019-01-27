const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const streamPromise = require('stream-to-promise')
const makeDir = require('make-dir')
const createReadStream = fs.createReadStream
const createWriteStream = fs.createWriteStream

module.exports = (cacheDir, transform) => async (from, code) => {
  const hash = crypto.createHash('md5').update(code).digest('hex')
  const cacheFile = path.join(cacheDir, hash)
  const exists = fs.existsSync(cacheFile)

  if (exists) {
    const stream = createReadStream(cacheFile)

    return streamPromise(stream)
  }

  const result = await transform(from, code)

  await makeDir(path.dirname(cacheFile))

  const stream = createWriteStream(cacheFile)

  stream.end(result)

  await streamPromise(stream)

  return result
}
