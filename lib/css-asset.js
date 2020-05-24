const postcss = require('postcss')
const autoprefixer = require('autoprefixer')
const cssnano = require('cssnano')
const valueParser = require('postcss-value-parser')

module.exports = (args, resolver) => {
  return {
    extensions: ['.css'],
    contentType: 'text/css',
    async transform(from, code, dependencies = []) {
      const result = await postcss([
        autoprefixer(),
        cssnano({preset: 'default'}),
        (root) => {
          root.walkAtRules((rule, b) => {
            if (rule.name === 'import') {
              const parsed = valueParser(rule.params)

              const node =
                parsed.nodes[0].value === 'url'
                  ? parsed.nodes[0].nodes[0]
                  : parsed.nodes[0]

              const dependency = resolver(node.value)

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
