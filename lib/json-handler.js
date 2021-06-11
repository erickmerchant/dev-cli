import {createWriteStream} from 'fs'
import fs from 'fs/promises'
import {gray, green, yellow} from 'kleur/colors'
import mime from 'mime-types'
import path from 'path'
import * as stream from 'stream'
import {promisify} from 'util'

import {find} from './resolver.js'

const finished = promisify(stream.finished)

export const jsonHandler = async (req, res, url, args) => {
  if (url.pathname.endsWith('.json')) {
    const {stats, pathname} = await find(url.pathname, args.src)

    if (req.method === 'POST' || req.method === 'PUT') {
      if (stats && req.method === 'POST') {
        res.writeHead(409)

        res.end('')

        console.log(
          `${gray('[dev]')} ${req.method} ${yellow(409)} ${url.pathname}`
        )

        return true
      }

      await fs.mkdir(path.dirname(pathname), {
        recursive: true
      })

      const writeStream = createWriteStream(pathname)

      req.pipe(writeStream)

      await finished(writeStream)

      const statusCode = stats ? 200 : 201
      const contentType = mime.contentType('.json')

      res.writeHead(statusCode, {
        'Content-Type': contentType
      })

      res.end('')

      console.log(
        `${gray('[dev]')} ${req.method} ${green(statusCode)} ${
          url.pathname
        } ${gray(contentType)}`
      )

      return true
    }

    if (req.method === 'DELETE') {
      if (stats) {
        await fs.rm(pathname)
      }

      res.writeHead(200)

      res.end('')

      console.log(
        `${gray('[dev]')} ${req.method} ${green(200)} ${url.pathname}`
      )

      return true
    }
  }

  if (req.method !== 'GET') {
    res.writeHead(405)

    res.end('')

    console.log(`${gray('[dev]')} ${req.method} ${yellow(405)} ${url.pathname}`)

    return true
  }
}
