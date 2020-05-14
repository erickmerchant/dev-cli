const path = require('path')
const fs = require('fs')
const {promisify} = require('util')
const readFile = promisify(fs.readFile)

module.exports = async (importmapFile) => {
  const importmapString = await readFile(path.join(process.cwd(), importmapFile))

  const importmapJson = JSON.parse(importmapString)

  const keys = Object.keys(importmapJson?.imports ?? {}).sort()

  return (value) => {
    for (const key of keys) {
      if (value === key) {
        return importmapJson.imports[key]
      } else if (key.endsWith('/') && value.startsWith(key)) {
        return `${importmapJson.imports[key]}${value.substring(key.length)}`
      }
    }

    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
      return value
    }

    throw Error(`module unfound ${value}`)
  }
}
