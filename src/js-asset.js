const babel = require('@babel/core')
const promisify = require('util').promisify
const presetEnv = require('@babel/preset-env')
const presetMinify = require('babel-preset-minify')
const transform = promisify(babel.transform)
const getImportPath = require('./get-import-path.js')
const browsers = require('./browsers.js')
const path = require('path')

module.exports = (args) => {
  const cwd = process.cwd()

  return {
    src: args.src,
    extensions: ['.mjs', '.js'],
    contentType: 'text/javascript',
    async transform(from, code) {
      const dependencies = []

      const result = await transform(code, {
        sourceType: 'module',
        sourceMaps: args.dev ? 'inline' : false,
        sourceFileName: from,
        presets: [
          [presetEnv, {
            targets: browsers,
            modules: false
          }],
          [presetMinify, {
            mangle: {
              topLevel: true
            }
          }]
        ],
        plugins: [
          () => {
            return {
              visitor: {
                CallExpression({node}) {
                  const [source] = node.arguments

                  if (node.callee.type === 'Import' && source.type === 'StringLiteral') {
                    const importPath = getImportPath(from, source.value, 'module')

                    source.value = importPath

                    dependencies.push(importPath)
                  }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'({node}) {
                  if (node.source != null) {
                    const importPath = getImportPath(from, node.source.value, 'module')

                    node.source.value = importPath

                    dependencies.push(importPath)
                  }
                }
              }
            }
          }
        ]
      })

      return {
        dependencies,
        code: result.code
      }
    }
  }
}
