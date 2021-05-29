import fs from 'fs'
import mime from 'mime-types'
import path from 'path'
import {gray, green} from 'sergeant'
import {promisify} from 'util'

import {jsAsset} from './js-asset.js'

const readFile = promisify(fs.readFile)
const etagSuffix = Date.now().toString(16)

export const fileHandler = async (req, res, meta) => {
  const etag = `W/"${meta.stats.size.toString(16)}-${meta.stats.mtime
    .getTime()
    .toString(16)}-${etagSuffix}"`

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304)

    res.end('')

    console.log(
      `${gray('[dev]')} ${req.method} ${green(304)} ${meta.url.pathname}`
    )

    return true
  }

  let code = await readFile(meta.pathname)

  let transform = false

  if (jsAsset.extensions.includes(path.extname(meta.pathname))) {
    transform = true
  }

  if (transform) {
    code = await jsAsset.transform(String(code), meta)
  }

  const contentType = mime.contentType(path.extname(meta.pathname))

  const headers = {
    'ETag': etag,
    'Content-Type': contentType
  }

  res.writeHead(200, headers)

  res.end(code)

  console.log(
    `${gray('[dev]')} ${req.method} ${green(200)} ${meta.url.pathname} ${gray(
      contentType
    )}`
  )

  return true
}
