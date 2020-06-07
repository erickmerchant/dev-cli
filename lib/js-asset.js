const babel = require('@babel/core')
const promisify = require('util').promisify
const presetEnv = require('@babel/preset-env')
const terser = require('terser')
const transform = promisify(babel.transform)
const resolver = require('./resolver.js')

module.exports = (args) => {
  return {
    extensions: ['.mjs', '.js'],
    contentType: 'text/javascript',
    async transform(from, code, dependencies = []) {
      const result = await transform(code, {
        sourceType: 'module',
        sourceMaps: args.dev ? 'inline' : false,
        sourceFileName: from,
        presets: [
          [
            presetEnv,
            {
              modules: false,
              targets: {esmodules: true},
              bugfixes: true
            }
          ]
        ],
        plugins: [
          () => {
            return {
              visitor: {
                'CallExpression'({node}) {
                  const [source] = node.arguments

                  if (
                    node.callee.type === 'Import' &&
                    source.type === 'StringLiteral'
                  ) {
                    const dependency = resolver(source.value)

                    source.value = dependency

                    dependencies.push(dependency)
                  }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'({
                  node
                }) {
                  if (node.source != null) {
                    const dependency = resolver(node.source.value)

                    node.source.value = dependency

                    dependencies.push(dependency)
                  }
                }
              }
            }
          }
        ]
      })

      const compressed = terser.minify(String(result.code), {
        mangle: {
          toplevel: true
        },
        ecma: 8,
        safari10: true,
        sourceMap: args.dev
          ? {
              content: 'inline',
              filename: from,
              url: 'inline'
            }
          : false
      })

      return compressed.code
    }
  }
}
