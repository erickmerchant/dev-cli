import babel from '@babel/core'
import presetEnv from '@babel/preset-env'

import {createEntryPlugin} from './entry-plugin.js'
import {createImportsPlugin} from './imports-plugin.js'
import {resolve, runtimeId} from './resolver.js'
import {createTemplatesPlugin} from './templates-plugin.js'

const {transformFromAstAsync, parse, traverse} = babel

export const jsAsset = (args) => {
  return {
    extensions: ['.mjs', '.js'],
    contentType: 'text/javascript',
    async transform(from, code) {
      const promises = []
      const map = {}
      const isEntry = from.endsWith('.html') && args.command === 'serve'

      const parsed = parse(String(code))

      if (isEntry) {
        promises.push(
          resolve(runtimeId, from, args.src).then(async (url) => {
            map[runtimeId] = {
              url
            }
          })
        )
      }

      traverse(parsed, {
        'CallExpression'({node}) {
          const [source] = node.arguments

          if (
            node.callee.type === 'Import' &&
            source.type === 'StringLiteral'
          ) {
            promises.push(
              resolve(source.value, from, args.src).then(async (url) => {
                map[source.value] = {
                  url
                }
              })
            )
          }
        },
        'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'({
          node
        }) {
          if (node.source != null) {
            promises.push(
              resolve(node.source.value, from, args.src).then(async (url) => {
                const mapped = {
                  url
                }

                if (isEntry) {
                  mapped.specifiers = {}

                  for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportNamespaceSpecifier') {
                      mapped.specifiers['*'] = specifier.local.name
                    }

                    if (specifier.type === 'ImportSpecifier') {
                      mapped.specifiers[specifier.imported.name] =
                        specifier.local.name
                    }

                    if (specifier.type === 'ImportDefaultSpecifier') {
                      mapped.specifiers['default'] = specifier.local.name
                    }
                  }
                }

                map[node.source.value] = mapped
              })
            )
          }
        }
      })

      await Promise.all(promises)

      const plugins = []

      if (isEntry) {
        plugins.push(createEntryPlugin(map))
      }

      plugins.push(createImportsPlugin(map))

      plugins.push(createTemplatesPlugin(map))

      const result = await transformFromAstAsync(parsed, code, {
        sourceType: 'module',
        sourceMaps: args['--dev'] ? 'inline' : false,
        sourceFileName: from,
        presets: [
          [
            presetEnv,
            {
              modules: false,
              targets: 'supports es6-module and defaults',
              bugfixes: true
            }
          ]
        ],
        plugins
      })

      return result.code
    }
  }
}
