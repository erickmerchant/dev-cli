const babel = require('@babel/core')
const promisify = require('util').promisify
const babelPresetEnv = require('@babel/preset-env')
const babelPresetMinify = require('babel-preset-minify')
const babelTransform = promisify(babel.transform)
const getImportPath = require('./get-import-path.js')
const path = require('path')
const detect = require('detective-es6')

module.exports = (args) => {
  const cwd = process.cwd()
  const directories = [cwd, path.join(cwd, args.src)]

  return {
    detect,
    src: args.src,
    extensions: ['.mjs', '.js'],
    contentType: 'text/javascript',
    async transform (from, code) {
      const result = await babelTransform(code, {
        sourceType: 'module',
        sourceMaps: args.dev ? 'inline' : false,
        sourceFileName: from,
        presets: [
          [babelPresetEnv, { modules: false }],
          babelPresetMinify
        ],
        plugins: [
          () => ({
            visitor: {
              CallExpression ({ node }) {
                const [source] = node.arguments

                if (node.callee.type === 'Import' && source.type === 'StringLiteral') {
                  source.value = getImportPath(source.value, 'module', directories)
                }
              },
              'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration' ({ node }) {
                if (node.source != null) {
                  node.source.value = getImportPath(node.source.value, 'module', directories)
                }
              }
            }
          })
        ]
      })

      return result.code
    }
  }
}
