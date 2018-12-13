const resolve = require('browser-resolve')

const isBareImport = require('./is-bare-import.js')

module.exports = (value, browser, directories) => {
  if (!isBareImport(value)) return value

  const resolved = resolve.sync(value, { browser }) || resolve.sync(value)

  for (const directory of directories) {
    if (resolved.startsWith(directory)) {
      return resolved.substring(directory.length)
    }
  }

  return resolved
}
