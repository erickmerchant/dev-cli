const resolve = require('browser-resolve')
const path = require('path')

const isBareImport = (value) => !value.startsWith('.') && !value.startsWith('/')

module.exports = (dir, value, browser) => {
  if (!isBareImport(value)) {
    if (value.startsWith('/')) return value

    return path.join(path.dirname(dir), value)
  }

  const resolved = resolve.sync(value, {browser}) || resolve.sync(value)

  return resolved.substring(process.cwd().length)
}
