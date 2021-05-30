import chokidar from 'chokidar'
import path from 'path'
import {gray, green} from 'sergeant'

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

    const getWatchCallback = (base) => (type, file) => {
      changedFiles.push(path.relative(base, file))

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

    for (const src of meta.args.src) {
      chokidar
        .watch(path.join(process.cwd(), src), {ignoreInitial: true})
        .on('all', getWatchCallback(path.join(process.cwd(), src)))
    }

    res.write(`\n\n`)

    console.log(
      `${gray('[dev]')} ${req.method} ${green(200)} ${pathname} ${gray(
        'text/event-stream'
      )}`
    )

    return true
  }
}
