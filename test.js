const test = require('tape')
const fs = require('fs')
const path = require('path')
const http2 = require('http2')
const {gray} = require('kleur')
const execa = require('execa')
const getPort = require('get-port')
const streamPromise = require('stream-to-promise')

const noopDeps = {
  console: {
    log() {}
  }
}

const htmlOptions = {
  accept: 'text/html,*/*'
}

test('serve.js - good response', async (t) => {
  t.plan(4)

  const port = await getPort()

  require('./serve')(noopDeps)({port, src: './fixtures/'}, async (err, app) => {
    t.error(err)

    try {
      const client = http2.connect(`https://localhost:${port}`, {
        ca: fs.readFileSync(path.join(__dirname, './storage/cert.pem'))
      })

      client.on('error', (err) => console.error(err))

      const req = client.request({':path': '/', ...htmlOptions})

      let statusCode
      let contentType

      req.on('response', (headers, flags) => {
        statusCode = headers[':status']
        contentType = headers['content-type']
      })

      req.setEncoding('utf8')

      const response = await streamPromise(req)

      client.close()

      t.equal(200, statusCode)

      t.equal('text/html; charset=utf-8', contentType.toLowerCase())

      t.equal('<!DOCTYPE html><html><head></head><body>\n    <h1>index</h1>\n  \n\n</body></html>', String(response))
    } catch (e) {
      t.error(e)
    }

    app.close()
  })
})

test('serve.js - output', async (t) => {
  t.plan(2)

  const output = []
  const console = {
    log(line) {
      output.push(line.toString('utf8'))
    }
  }

  const port = await getPort()

  require('./serve')({console})({port, src: './fixtures/'}, async (err, app) => {
    t.error(err)

    try {
      const client = http2.connect(`https://localhost:${port}`, {
        ca: fs.readFileSync(path.join(__dirname, './storage/cert.pem'))
      })

      client.on('error', (err) => console.error(err))

      const req = client.request({':path': '/', ...htmlOptions})

      req.setEncoding('utf8')

      await streamPromise(req)

      client.close()
    } catch (e) {
      t.error(e)
    }

    app.close(() => {
      t.deepEqual(output, [
        `${gray('[dev]')} server is listening at port ${port}`
      ])
    })
  })
})

test('cli.js serve', async (t) => {
  t.plan(4)

  try {
    await execa('node', ['./cli.js', 'serve', '-h'])
  } catch (e) {
    t.ok(e)

    t.equal(e.stdout.includes('Usage'), true)

    t.equal(e.stdout.includes('Options'), true)

    t.equal(e.stdout.includes('Parameters'), true)
  }
})
