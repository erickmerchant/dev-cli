const polka = require('polka')
const sirv = require('sirv')
const chalk = require('chalk')
const path = require('path')
const assert = require('assert')
const error = require('sergeant/error')
const promisify = require('util').promisify
const fs = require('fs')
const access = promisify(fs.access)
const createReadStream = fs.createReadStream

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  return async (args, cb = () => {}) => {
    const app = polka({
      onError (err, req, res) {
        error(err)

        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })

        res.end('')
      }
    })

    app.use(sirv(args.directory, {
      etag: true,
      dev: true
    }))

    app.use(async (req, res, next) => {
      try {
        const file = path.resolve(args.directory, 'index.html')

        await access(file, fs.constants.R_OK)

        res.writeHead(200, { 'content-type': 'text/html' })

        createReadStream(file, 'utf-8').pipe(res)
      } catch (err) {
        error(err)
      }

      res.statusCode = 500

      res.end()
    })

    app.listen(args.port, (err) => {
      if (err) {
        error(err)

        cb(err)
      } else {
        deps.out.write(`${chalk.gray('[dev]')} server is listening at port ${args.port}\n`)

        cb(null, app)
      }
    })
  }
}
