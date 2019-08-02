const test = require('tape')
const got = require('got')
const {gray} = require('kleur')
const execa = require('execa')
const getPort = require('get-port')

const noopDeps = {
  console: {
    log() {}
  }
}

const htmlOptions = {
  headers: {
    accept: 'text/html,*/*'
  }
}

test('serve.js - good response', async (t) => {
  t.plan(4)

  const port = await getPort()

  require('./serve')(noopDeps)({port, src: './fixtures/'}, async (err, app) => {
    t.error(err)

    try {
      const response = await got(`http://localhost:${port}/`, htmlOptions)

      t.equal(200, response.statusCode)

      t.equal('text/html; charset=utf-8', response.headers['content-type'].toLowerCase())

      t.equal('<!DOCTYPE html><html><head></head><body>\n    <h1>index</h1>\n  \n\n</body></html>', response.body)
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
      await got(`http://localhost:${port}/`, htmlOptions)
    } catch (e) {
      t.error(e)
    }

    app.close(() => {
      t.deepEqual(output, [
        `${gray('[dev]')} go to http://localhost:${port}`
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
