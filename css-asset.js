const cssnano = require('cssnano')
const postcss = require('postcss')
const valueParser = require('postcss-value-parser')
const postcssPresetEnv = require('postcss-preset-env')
const getImportPath = require('./get-import-path.js')
const path = require('path')
const detect = require('detective-postcss')

module.exports = (args) => {
  const cwd = process.cwd()
  const directories = [cwd, path.join(cwd, args.src)]

  return {
    detect,
    src: args.src,
    extensions: ['.css'],
    contentType: 'text/css',
    async transform (from, code) {
      const result = await postcss([
        postcssPresetEnv(),
        cssnano({ preset: 'default' }),
        (root, result) => {
          root.walkAtRules((rule, b) => {
            if (rule.name === 'import') {
              const parsed = valueParser(rule.params)

              parsed.nodes[0].value = getImportPath(parsed.nodes[0].value, 'style', directories)

              rule.params = String(parsed)
            }
          })
        }
      ]).process(code, {
        from,
        map: args.dev ? { inline: true } : false
      })

      return result.css
    }
  }
}
