const cssnano = require('cssnano')
const postcss = require('postcss')
const valueParser = require('postcss-value-parser')
const presetEnv = require('postcss-preset-env')
const getImportPath = require('./get-import-path.js')
const browsers = require('./browsers.js')

module.exports = (args) => {
  return {
    src: args.src,
    extensions: ['.css'],
    contentType: 'text/css',
    async transform(from, code) {
      const dependencies = []

      const result = await postcss([
        presetEnv({browsers}),
        cssnano({preset: 'default'}),
        (root, result) => {
          root.walkAtRules((rule, b) => {
            if (rule.name === 'import') {
              const parsed = valueParser(rule.params)

              const importPath = getImportPath(from, parsed.nodes[0].value, 'style')

              dependencies.push(importPath)

              parsed.nodes[0].value = importPath

              rule.params = String(parsed)
            }
          })
        }
      ]).process(code, {
        from,
        map: args.dev ? {inline: true} : false
      })

      return {
        dependencies,
        code: result.css
      }
    }
  }
}
