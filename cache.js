const assert = require('assert')
const got = require('got')
const serve = require('./serve.js')

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  return (args) => {
    serve(deps)(args, async (_, app) => {
      const response = await got(`http://localhost:${args.port}/`)

      console.log(response.body)

      app.server.close()
    })
  }
}
