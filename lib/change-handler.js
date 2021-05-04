import chokidar from 'chokidar'
import {gray, green} from 'sergeant'

import {findAll} from './resolver.js'

export const changeHandler = async (req, res, meta) => {
  const pathname = new URL(req.url, 'http://localhost').pathname

  if (req.headers.accept === 'text/event-stream') {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }

    res.writeHead(200, headers)

    const changedFiles = []
    let timeout

    const getWatchCallback = (watchFiles) => (type, file) => {
      if (watchFiles[file] && !changedFiles.includes(watchFiles[file])) {
        changedFiles.push(watchFiles[file])

        if (timeout) {
          clearTimeout(timeout)
        }

        timeout = setTimeout(
          () =>
            res.write(
              `data: ${JSON.stringify({
                files: changedFiles.splice(0, changedFiles.length)
              })}\n\n`
            ),
          500
        )
      }
    }

    const watchFiles = {}

    for (const f of meta.dependencies) {
      const {pathname} = await findAll(f, meta.args.src)

      if (pathname) {
        watchFiles[pathname] = f
      }
    }

    chokidar
      .watch(Object.keys(watchFiles), {ignoreInitial: true})
      .on('all', getWatchCallback(watchFiles))

    res.write(`\n\n`)

    console.log(
      `${gray('[dev]')} ${req.method} ${green(200)} ${pathname} ${gray(
        'text/event-stream'
      )}`
    )

    return true
  }
}
