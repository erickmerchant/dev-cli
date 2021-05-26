import fs from 'fs'
import mime from 'mime-types'
import path from 'path'
import {gray, green, yellow} from 'sergeant'
import {finished as _finished} from 'stream'
import {promisify} from 'util'

const finished = promisify(_finished)
const rm = promisify(fs.rm)
const mkdir = promisify(fs.mkdir)

export const jsonHandler = async (req, res, meta) => {
  if (meta.url.pathname.endsWith('.json')) {
    if (req.method === 'POST' || req.method === 'PUT') {
      if (meta.stats && req.method === 'POST') {
        res.writeHead(409)

        res.end('')

        console.log(
          `${gray('[dev]')} ${req.method} ${yellow(409)} ${meta.url.pathname}`
        )

        return true
      }

      await mkdir(path.dirname(meta.pathname), {
        recursive: true
      })

      const writeStream = fs.createWriteStream(meta.pathname)

      req.pipe(writeStream)

      await finished(writeStream)

      const statusCode = meta.stats ? 200 : 201
      const contentType = mime.contentType('.json')

      res.writeHead(statusCode, {
        'Content-Type': contentType
      })

      res.end('')

      console.log(
        `${gray('[dev]')} ${req.method} ${green(statusCode)} ${
          meta.url.pathname
        } ${gray(contentType)}`
      )

      return true
    }

    if (req.method === 'DELETE') {
      if (meta.stats) {
        await rm(meta.pathname)
      }

      res.writeHead(200)

      res.end('')

      console.log(
        `${gray('[dev]')} ${req.method} ${green(200)} ${meta.url.pathname}`
      )

      return true
    }
  }

  if (req.method !== 'GET') {
    res.writeHead(405)

    res.end('')

    console.log(
      `${gray('[dev]')} ${req.method} ${yellow(405)} ${meta.url.pathname}`
    )

    return true
  }
}
