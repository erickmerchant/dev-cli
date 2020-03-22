const babel = require('@babel/core')
const promisify = require('util').promisify
const presetEnv = require('@babel/preset-env')
const terser = require('terser')
const transform = promisify(babel.transform)
const getImportPath = require('./get-import-path.js')
const path = require('path')
const detectiveEs6 = require('detective-es6')

module.exports = (args) => {
  const cwd = process.cwd()
  const directories = [cwd, path.join(cwd, args.src)]

  return {
    async detect(code) { return detectiveEs6(code) },
    extensions: ['.mjs', '.js'],
    contentType: 'text/javascript',
    async transform(from, code) {
      const result = await transform(code, {
        sourceType: 'module',
        sourceMaps: args.dev ? 'inline' : false,
        sourceFileName: from,
        presets: [
          [presetEnv, {
            modules: false,
            targets: { esmodules: true },
            bugfixes: true
          }]
        ],
        plugins: [
          () => {
            return {
              visitor: {
                CallExpression({node}) {
                  const [source] = node.arguments

                  if (node.callee.type === 'Import' && source.type === 'StringLiteral') {
                    source.value = getImportPath(source.value, 'module', directories)
                  }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'({node}) {
                  if (node.source != null) {
                    node.source.value = getImportPath(node.source.value, 'module', directories)
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
