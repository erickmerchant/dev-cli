const promisify = require('util').promisify
const fs = require('fs')
const fstat = promisify(fs.stat)

module.exports = async (file) => {
  const stat = await fstat(file).catch(() => false)

  if (stat && stat.isFile()) {
    return stat
  }

  return false
}
