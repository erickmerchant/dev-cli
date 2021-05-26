import findUp from 'find-up'
import fs from 'fs'
import path from 'path'
import url from 'url'
import {promisify} from 'util'

const fstat = promisify(fs.stat)

const getStats = async (file) => {
  const stats = await fstat(file).catch(() => null)

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
      const stats = await fstat(path.join(process.cwd(), s, dir)).catch(
        () => null
      )

      if (stats?.isDirectory()) {
        return {stats: false, pathname: path.join(process.cwd(), s, file)}
      }
    }

    dir = path.dirname(dir)
  }

  return {stats: false, pathname: path.join(process.cwd(), src[0], file)}
}

export const isLocal = (key) => /^(\.{0,2}\/|[a-z]+:\/\/)/.test(key)

export const resolve = async (specifier, from, meta) => {
  let resolved

  if (!isLocal(specifier)) {
    resolved = url.fileURLToPath(
      await import.meta.resolve(specifier, `file://${from}`)
    )
  } else if (~from.indexOf(moduleDir)) {
    resolved = path.join(path.dirname(from), specifier)
  } else {
    return specifier
  }

  const file = resolved.substring(resolved.indexOf(moduleDir))

  if (meta.resolved) {
    meta.resolved.push(file)
  }

  return file
}
