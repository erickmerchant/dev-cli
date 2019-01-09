const test = require('tape')
const got = require('got')
const {gray} = require('kleur')
const execa = require('execa')
const getPort = require('get-port')
const stream = require('stream')
const out = new stream.Writable()

out._write = () => {}

const noopDeps = {
  out
}

test('serve.js - good response', async (t) => {
  t.plan(4)

  const port = await getPort()

  require('./serve')(noopDeps)({port, src: './fixtures/'}, async (err, app) => {
    t.error(err)

    try {
      const response = await got(`http://localhost:${port}/`)

      t.equal(200, response.statusCode)

      t.equal('text/html', response.headers['content-type'].toLowerCase())

      t.equal('<h1>index</h1>\n', response.body)
    } catch (e) {
      t.error(e)
    }

    app.server.close()
  })
})

test('serve.js - output', async (t) => {
  t.plan(2)

  const out = new stream.Writable()
  const output = []

  out._write = (line, encoding, done) => {
    output.push(line.toString('utf8'))

    done()
  }

  const port = await getPort()

  require('./serve')({
    out
  })({port, src: './fixtures/'}, async (err, app) => {
    t.error(err)

    try {
      await got(`http://localhost:${port}/`)
    } catch (e) {
      t.error(e)
    }

    app.server.close(() => {
      t.deepEqual(output, [
        `${gray('[dev]')} server is listening at port ${port}\n`
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

    t.equal(e.stderr.includes('Usage'), true)

    t.equal(e.stderr.includes('Options'), true)

    t.equal(e.stderr.includes('Parameters'), true)
  }
})
