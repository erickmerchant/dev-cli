import findUp from 'find-up'
import fs from 'fs/promises'
import path from 'path'
import url from 'url'

const getStats = async (file) => {
  const stats = await fs.stat(file).catch(() => null)

  if (stats?.isFile()) {
    return stats
  }

  return false
}

const moduleDir = '/node_modules/'

export const runtimeId = '@erickmerchant/dev-cli'

export const find = async (file, src) => {
  if (file.startsWith(moduleDir)) {
    const pathname = await findUp(file.substring(1))

    const stats = await getStats(pathname)

    return {stats, pathname}
  }

  const pathnames = src.map((s) => path.join(process.cwd(), s, file))

  let pathname
  let stats = false

  while (pathnames.length) {
    pathname = pathnames.shift()

    stats = await getStats(pathname)

    if (stats) {
      return {stats, pathname}
    }
  }

  let dir = path.dirname(file)

  while (dir !== '.') {
    for (const s of src) {
      const stats = await fs
        .stat(path.join(process.cwd(), s, dir))
        .catch(() => null)

      if (stats?.isDirectory()) {
        const result = {
          stats: false,
          pathname: path.join(process.cwd(), s, file)
        }

        return result
      }
    }

    dir = path.dirname(dir)
  }

  const result = {
    stats: false,
    pathname: path.join(process.cwd(), src[0], file)
  }

  return result
}

export const isLocal = (key) => /^(\.{0,2}\/|[a-z]+:\/\/)/.test(key)

export const resolved = []

export const resolve = async (specifier, from) => {
  let result

  if (!isLocal(specifier)) {
    result = url.fileURLToPath(
      await import.meta.resolve(specifier, `file://${from}`)
    )
  } else if (~from.indexOf(moduleDir)) {
    result = path.join(path.dirname(from), specifier)
  } else {
    return specifier
  }

  const file = result.substring(result.indexOf(moduleDir))

  resolved.push(file)

  return file
}
