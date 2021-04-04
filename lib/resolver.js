import findUp from 'find-up'
import path from 'path'
import url from 'url'

const urls = []

const moduleDir = '/node_modules/'

export const runtimeId = '@erickmerchant/dev-cli'

export const find = async (file, src) => {
  if (file.startsWith(moduleDir)) {
    const found = await findUp(file.substring(1))

    return [found]
  }

  return src.map((src) => path.join(process.cwd(), src, file))
}

export const isLocal = (key) => /^(\.{0,2}\/|[a-z]+:\/\/)/.test(key)

export const resolve = async (specifier, from) => {
  let resolved

  if (!isLocal(specifier)) {
    resolved = url.fileURLToPath(
      await import.meta.resolve(
        specifier,
        `file://${path.join(process.cwd(), from)}`
      )
    )
  } else if (~from.indexOf(moduleDir)) {
    resolved = path.join(path.dirname(from), specifier)
  } else {
    return specifier
  }

  const file = resolved.substring(resolved.indexOf(moduleDir))

  urls.push(file)

  return file
}

export const list = () => {
  return urls
}
