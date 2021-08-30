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
  file = decodeURI(file)

  let pathname

  if (file.startsWith(moduleDir)) {
    pathname = await findUp(file.substring(1))
  } else {
    pathname = path.join(process.cwd(), src, file)
  }

  const stats = await getStats(pathname)

  return {stats, pathname}
}

export const isLocal = (key) => /^(\.{0,2}\/|[a-z]+:\/\/)/.test(key)

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

  return file
}
