import path from 'path'
import url from 'url'

const urls = []

const moduleDir = '/node_modules/'

export const find = (file, src) => {
  if (file.startsWith(moduleDir)) {
    return [path.join(process.cwd(), file)]
  }

  return src.map((src) => path.join(process.cwd(), src, file))
}

export const resolve = async (specifier, from) => {
  if (!/^(\.{0,2}\/|[a-z]+:\/\/)/.test(specifier)) {
    const resolved = await import.meta.resolve(
      specifier,
      `file://${path.join(process.cwd(), from)}`
    )

    const file = `/${path.relative(process.cwd(), url.fileURLToPath(resolved))}`

    urls.push(file)

    return file
  }

  return specifier
}

export const list = () => {
  return urls
}
