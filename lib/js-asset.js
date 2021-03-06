import babel from '@babel/core'
import presetEnv from '@babel/preset-env'
import t from '@babel/types'

const {transformFromAstAsync, parse, traverse} = babel

const isInSrc = (key) =>
  key.startsWith('/') ||
  key.startsWith('./') ||
  key.startsWith('../') ||
  key.startsWith('http://') ||
  key.startsWith('https://')

const runtimeUrl = '@erickmerchant/dev-cli/runtime.js'

export default (args) => {
  return {
    extensions: ['.mjs', '.js'],
    contentType: 'text/javascript',
    async transform(from, code) {
      const {resolve} = await import('./resolver.js')
      const promises = []
      const map = {}
      const isEntry = (args['--entry'] ?? 'index.html') === from
      let initUid
      let updateUid
      let runUid
      let useUid

      const parsed = parse(String(code))

      if (isEntry) {
        promises.push(
          resolve(runtimeUrl, from, args.src).then(async (url) => {
            map[runtimeUrl] = {
              url
            }
          })
        )
      }

      traverse(parsed, {
        'Program'(path) {
          if (isEntry) {
            runUid = path.scope.generateUid('run')
            useUid = path.scope.generateUid('use')

            path.unshiftContainer(
              'body',
              t.importDeclaration(
                [
                  t.importSpecifier(t.identifier(runUid), t.identifier('run')),
                  t.importSpecifier(t.identifier(useUid), t.identifier('use'))
                ],
                t.stringLiteral(runtimeUrl)
              )
            )
          }
        },
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
        },
        'ExportDeclaration'(path) {
          const {node, scope} = path

          if (isEntry) {
            for (const s of node.specifiers) {
              if (s.exported.name === '__update') {
                updateUid = updateUid ?? scope.generateUid(s.local.name)

                scope.rename(s.local.name, updateUid)
              }
            }

            if (node.declaration) {
              for (const d of node.declaration.declarations) {
                if (d.id.name === '__update') {
                  updateUid = updateUid ?? scope.generateUid('__update')

                  scope.rename('__update', updateUid)
                }
              }

              path.insertBefore(t.cloneNode(node.declaration, true))
            }

            path.remove()
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
          ]
        ],
        plugins: [
          () => {
            return {
              visitor: {
                'Program'(path) {
                  path.traverse({
                    TemplateElement(path) {
                      const parent = path.findParent((path) =>
                        path.isTaggedTemplateExpression()
                      )

                      if (parent?.node?.tag?.name === 'html') {
                        const value = path.node.value

                        const raw = value.raw
                          .replace(/\s+/g, ' ')
                          .replace(/> </g, '><')
                          .replace(/> $/g, '>')
                          .replace(/ >/g, '>')
                          .replace(/^ </g, '<')
                          .replace(/< /g, '<')

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
                'VariableDeclarator'({node}) {
                  if (
                    updateUid != null &&
                    node.id.name === updateUid &&
                    !node.init.params.length
                  ) {
                    const container = []

                    for (const [key, val] of Object.entries(map)) {
                      if (isInSrc(key)) {
                        if (val.specifiers) {
                          for (const s of Object.values(val.specifiers)) {
                            container.push(
                              t.objectProperty(t.identifier(s), t.identifier(s))
                            )
                          }
                        }
                      }
                    }

                    node.init.params.push(t.objectPattern(container))
                  }
                },
                'CallExpression'(path) {
                  const [source] = path.node.arguments

                  if (
                    path.node.callee.type === 'Import' &&
                    source.type === 'StringLiteral' &&
                    map[source.value]
                  ) {
                    source.value = map[source.value].url
                  }

                  if (updateUid && path.node.callee.name === updateUid) {
                    for (const [key, val] of Object.entries(map)) {
                      if (isInSrc(key)) {
                        const specifiers = []
                        for (const [k, v] of Object.entries(val.specifiers)) {
                          specifiers.push(
                            t.objectProperty(
                              t.stringLiteral(k),
                              t.stringLiteral(v)
                            )
                          )
                        }

                        path.insertBefore(
                          t.callExpression(t.identifier(useUid), [
                            t.stringLiteral(val.url),
                            t.objectExpression(specifiers)
                          ])
                        )
                      }
                    }

                    initUid = path.scope.generateUid('init')

                    const callExpression = t.callExpression(
                      t.identifier(runUid),
                      [t.identifier(initUid)]
                    )

                    path.replaceWith(callExpression)

                    const container = []

                    for (const [key, val] of Object.entries(map)) {
                      if (isInSrc(key)) {
                        if (val.specifiers) {
                          for (const s of Object.values(val.specifiers)) {
                            container.push(
                              t.objectProperty(t.identifier(s), t.identifier(s))
                            )
                          }
                        }
                      }
                    }

                    const body = []

                    path
                      .findParent((p) => p.isProgram())
                      .traverse({
                        'Statement|VariableDeclaration'(p) {
                          if (!p.parentPath.isProgram()) return

                          const node = p.node
                          let n = node

                          if (node.type === 'ExpressionStatement') {
                            n = node.expression
                          }

                          if (
                            !(
                              n.type === 'CallExpression' &&
                              (n.callee.name === useUid ||
                                n.callee.name === runUid)
                            ) &&
                            !n.type.startsWith('Import') &&
                            !n.type.startsWith('Export')
                          ) {
                            body.push(t.cloneNode(node, true))

                            p.remove()
                          }
                        }
                      })

                    body.push(t.returnStatement(t.identifier(updateUid)))

                    path.insertBefore(
                      t.variableDeclaration('const', [
                        t.variableDeclarator(
                          t.identifier(initUid),
                          t.arrowFunctionExpression(
                            [t.objectPattern(container)],
                            t.blockStatement(body),
                            true
                          )
                        )
                      ])
                    )
                  }
                },
                'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(
                  path
                ) {
                  if (path.node.source != null) {
                    if (isEntry && isInSrc(path.node.source.value)) {
                      path.remove()
                    } else if (map[path.node.source.value]) {
                      path.node.source.value = map[path.node.source.value].url
                    }
                  }
                }
              }
            }
          }
        ]
      })

      return result.code
    }
  }
}
