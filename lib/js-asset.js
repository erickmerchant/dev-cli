import babel from '@babel/core'
import presetEnv from '@babel/preset-env'
import t from '@babel/types'
import {minify} from 'terser'

const {transformFromAstAsync, parse, traverse} = babel

export default (args) => {
  return {
    extensions: ['.mjs', '.js'],
    contentType: 'text/javascript',
    async transform(from, code) {
      const {resolve} = await import('./resolver.js')
      const promises = []
      const map = {}

      const ourPreset = {
        plugins: [
          () => {
            return {
              visitor: {
                'Program'(path) {
                  path.traverse({
                    TemplateElement(path) {
                      const taggedTemplateExpression = path.findParent((path) =>
                        path.isTaggedTemplateExpression()
                      )

                      if (
                        taggedTemplateExpression?.node?.tag?.name === 'html'
                      ) {
                        const value = path.node.value
                        const raw = value.raw.replace(/(\\n|\\t|\s)+/g, ' ')

                        if (raw === value.raw) return

                        path.replaceWith(
                          t.templateElement(
                            {
                              raw,
                              cooked: value.cooked
                            },
                            path.node.tail
                          )
                        )
                      }
                    }
                  })
                },
                'CallExpression'({node}) {
                  const [source] = node.arguments

                  if (
                    node.callee.type === 'Import' &&
                    source.type === 'StringLiteral'
                  ) {
                    source.value = map[source.value]
                  }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'({
                  node
                }) {
                  if (node.source != null) {
                    node.source.value = map[node.source.value]
                  }
                }
              }
            }
          }
        ]
      }

      const parsed = parse(String(code))

      traverse(parsed, {
        'CallExpression'({node}) {
          const [source] = node.arguments

          if (
            node.callee.type === 'Import' &&
            source.type === 'StringLiteral'
          ) {
            promises.push(
              resolve(source.value, from, args.src).then(async (dependency) => {
                map[source.value] = dependency
              })
            )
          }
        },
        'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'({
          node
        }) {
          if (node.source != null) {
            promises.push(
              resolve(node.source.value, from, args.src).then(
                async (dependency) => {
                  map[node.source.value] = dependency
                }
              )
            )
          }
        }
      })

      await Promise.all(promises)

      const result = await transformFromAstAsync(parsed, code, {
        sourceType: 'module',
        sourceMaps: args['--dev'] ? 'inline' : false,
        sourceFileName: from,
        presets: [
          [
            presetEnv,
            {
              modules: false,
              targets: {esmodules: true},
              bugfixes: true
            }
          ],
          ourPreset
        ]
      })

      const compressed = await minify(String(result.code), {
        ecma: 10,
        compress: true,
        mangle: true,
        module: true,
        safari10: true,
        sourceMap: args['--dev']
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
