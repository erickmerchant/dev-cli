import findUp from 'find-up'
import fs from 'fs'
import path from 'path'
import url from 'url'
import {promisify} from 'util'

const fstat = promisify(fs.stat)

const getStats = async (file) => {
  const stats = await fstat(file).catch(() => false)

  if (stats && stats.isFile()) {
    return stats
  }

  return false
}

const moduleDir = '/node_modules/'

export const runtimeId = '@erickmerchant/dev-cli'

export const findOne = async (file, src) => {
  if (file.startsWith(moduleDir)) {
    const pathname = await findUp(file.substring(1))

    const stats = await getStats(pathname)

    return {stats, pathname}
  }

  const pathname = path.join(process.cwd(), src, file)

  const stats = await getStats(pathname)

  return {stats, pathname}
}

export const findAll = async (file, src) => {
  if (file.startsWith(moduleDir)) {
    const pathname = await findUp(file.substring(1))

    const stats = await getStats(pathname)

    return {stats, pathname}
  }

  const pathnames = src.map((src) => path.join(process.cwd(), src, file))

  let pathname
  let stats = false

  while (pathnames.length) {
    pathname = pathnames.shift()

    stats = await getStats(pathname)

    if (stats) {
      break
    }
  }

  return {stats, pathname}
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

  meta.resolved.push(file)

  return file
}
