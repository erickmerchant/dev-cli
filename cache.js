const assert = require('assert')
const path = require('path')
const globby = require('globby')

module.exports = (deps) => {
  assert.ok(deps.out)

  assert.strictEqual(typeof deps.out.write, 'function')

  return async (args) => {
    const files = await globby([path.join(args.src, '**/*')])

    console.log(files)
  }
}
