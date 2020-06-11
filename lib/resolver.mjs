import path from 'path'
import url from 'url'

const paths = []
const urls = []
const dirnames = []

export const find = (url, src) => {
  const index = urls.indexOf(url)

  if (index > -1) {
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

  from = find(from, src)

  const result = url.fileURLToPath(
    await import.meta.resolve(specifier, `file://${from}`)
  )

  let dirname = path.dirname(result)

  let basename = path.basename(result)

  const indexOfSpecifier = result.indexOf(specifier)

  if (indexOfSpecifier > -1) {
    dirname = result.substring(0, indexOfSpecifier)

    basename = result.substring(indexOfSpecifier)
  }

  const hashedDir =
    dirnames.indexOf(dirname) > -1
      ? dirnames.indexOf(dirname)
      : dirnames.push(dirname) - 1

  const combined = `/__modules/${hashedDir}/${basename}`

  urls.push(combined)

  paths.push(result)

  return combined
}

export const list = () => {
  return urls
}
