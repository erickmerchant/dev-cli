import path from 'path'
import url from 'url'

const paths = []
const urls = []
const dirnames = []

export const find = (url, src) => {
  const index = urls.indexOf(url)

  if (~index) {
    return paths[index]
  }

  return path.join(process.cwd(), src, url)
}

export const resolve = async (specifier, from, src) => {
  if (
    specifier.startsWith('/') ||
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('http://') ||
    specifier.startsWith('https://')
  ) {
    return specifier
  }

  let result
  let error

  for (const s of src) {
    if (!result) {
      try {
        from = find(from, s)

        result = url.fileURLToPath(
          await import.meta.resolve(specifier, `file://${from}`)
        )
      } catch (err) {
        error = err
      }
    }
  }

  if (!result) {
    throw error
  }

  let dirname = path.dirname(result)

  let basename = path.basename(result)

  const indexOfSpecifier = result.indexOf(specifier)

  if (~indexOfSpecifier) {
    dirname = result.substring(0, indexOfSpecifier)

    basename = result.substring(indexOfSpecifier)
  }

  let moduleDir = `/__modules/${
    ~dirnames.indexOf(dirname)
      ? dirnames.indexOf(dirname)
      : dirnames.push(dirname) - 1
  }/`

  if (moduleDir === '/__modules/0/' && !/^\d+$/.test(basename)) {
    moduleDir = '/__modules/'
  }

  urls.push(`${moduleDir}${basename}`)

  paths.push(result)

  return `${moduleDir}${basename}`
}

export const list = () => {
  return urls
}
