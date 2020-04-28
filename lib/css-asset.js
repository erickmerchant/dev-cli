const postcss = require('postcss')
const autoprefixer = require('autoprefixer')
const cssnano = require('cssnano')
const valueParser = require('postcss-value-parser')
const getImportPath = require('./get-import-path.js')
const path = require('path')

module.exports = (args) => {
  const cwd = process.cwd()
  const directories = [cwd, path.join(cwd, args.src)]

  return {
    extensions: ['.css'],
    contentType: 'text/css',
    async transform(from, code, dependencies = []) {
      const result = await postcss([
        autoprefixer(),
        cssnano({preset: 'default'}),
        (root, result) => {
          root.walkAtRules((rule, b) => {
            if (rule.name === 'import') {
              const parsed = valueParser(rule.params)

              const node = parsed.nodes[0].value === 'url' ? parsed.nodes[0].nodes[0] : parsed.nodes[0]

              const dependency = getImportPath(node.value, 'style', directories)

              dependencies.push(dependency)

              node.value = dependency

              rule.params = String(parsed)
            }
          })
        }
      ]).process(code, {
        from,
        map: args.dev ? {inline: true} : false
      })

      return result.css
    }
  }
}
