import t from '@babel/types'

import {isLocal, runtimeId} from './resolver.js'

export const createEntryPlugin = (map, args) => () => {
  let mainUid, runUid, useUid, importUid

  return {
    visitor: {
      Program(path) {
        runUid = path.scope.generateUid('run')
        useUid = path.scope.generateUid('use')
        importUid = path.scope.generateUid('_import')
        mainUid = path.scope.generateUid('_main')

        if (args['--dev']) {
          path.unshiftContainer(
            'body',
            t.importDeclaration(
              [
                t.importSpecifier(t.identifier(runUid), t.identifier('run')),
                t.importSpecifier(t.identifier(useUid), t.identifier('use')),
                t.importSpecifier(
                  t.identifier(importUid),
                  t.identifier('_import')
                )
              ],
              t.stringLiteral(runtimeId)
            )
          )

          for (const [key, val] of Object.entries(map)) {
            if (isLocal(key)) {
              const specifiers = []
              const specifiers2 = []

              if (val.specifiers) {
                for (const [k, v] of Object.entries(val.specifiers)) {
                  specifiers.push(
                    t.objectProperty(t.stringLiteral(k), t.stringLiteral(v))
                  )
                  specifiers2.push(
                    t.objectProperty(t.stringLiteral(v), t.identifier(v))
                  )
                }

                path.pushContainer(
                  'body',
                  t.callExpression(t.identifier(useUid), [
                    t.newExpression(t.identifier('URL'), [
                      t.stringLiteral(val.url),
                      t.templateLiteral(
                        [
                          t.templateElement({
                            raw: 'https://',
                            cooked: 'https://'
                          }),
                          t.templateElement({raw: '/', cooked: '/'})
                        ],
                        [
                          t.memberExpression(
                            t.memberExpression(
                              t.identifier('window'),
                              t.identifier('location')
                            ),
                            t.identifier('host')
                          )
                        ]
                      )
                    ]),
                    t.objectExpression(specifiers),
                    t.objectExpression(specifiers2)
                  ])
                )
              }
            }
          }

          const callExpression = t.callExpression(t.identifier(runUid), [
            t.identifier(mainUid),
            t.newExpression(t.identifier('URL'), [
              t.memberExpression(
                t.memberExpression(
                  t.identifier('import'),
                  t.identifier('meta')
                ),
                t.identifier('url')
              ),
              t.templateLiteral(
                [
                  t.templateElement({raw: 'https://', cooked: 'https://'}),
                  t.templateElement({raw: '/', cooked: '/'})
                ],
                [
                  t.memberExpression(
                    t.memberExpression(
                      t.identifier('window'),
                      t.identifier('location')
                    ),
                    t.identifier('host')
                  )
                ]
              )
            ])
          ])

          path.pushContainer('body', callExpression)

          const container = []

          for (const [key, val] of Object.entries(map)) {
            if (isLocal(key)) {
              if (val.specifiers) {
                for (const s of Object.values(val.specifiers)) {
                  container.push(
                    t.objectProperty(t.identifier(s), t.identifier(s))
                  )
                }
              }
            }
          }
        } else {
          const callExpression = t.callExpression(t.identifier(mainUid), [])

          path.pushContainer('body', callExpression)
        }
      },
      VariableDeclarator(path) {
        if (mainUid != null && path.node.id.name === mainUid) {
          let i = 0

          for (const argument of args['--argument']) {
            const param = path.node.init.params[i++]

            if (param == null) break

            let val

            switch (true) {
              case argument === 'true' || argument === 'false':
                val = t.booleanLiteral(argument === 'true' ? true : false)
                break

              case !Number.isNaN(Number(argument)):
                val = t.numericLiteral(Number(argument))
                break

              default:
                val = t.stringLiteral(argument)
            }

            if (param.type === 'AssignmentPattern') {
              path.node.init.body.body.unshift(
                t.variableDeclaration('let', [
                  t.variableDeclarator(param.left, val)
                ])
              )
            } else {
              path.node.init.body.body.unshift(
                t.variableDeclaration('let', [t.variableDeclarator(param, val)])
              )
            }

            path.node.init.params.shift()
          }

          if (args['--dev']) {
            const container = []

            for (const [key, val] of Object.entries(map)) {
              if (isLocal(key)) {
                if (val.specifiers) {
                  for (const s of Object.values(val.specifiers)) {
                    container.push(
                      t.objectProperty(t.identifier(s), t.identifier(s))
                    )
                  }
                }
              }
            }

            path.node.init.params.unshift(t.objectPattern(container))
          }
        }
      },
      ExportDeclaration(path) {
        const {node, scope} = path

        for (const s of node.specifiers) {
          if (s.exported.name === '_main') {
            mainUid = mainUid ?? scope.generateUid(s.local.name)

            scope.rename(s.local.name, mainUid)
          }
        }

        if (node.declaration) {
          for (const d of node.declaration.declarations) {
            if (d.id.name === '_main') {
              mainUid = mainUid ?? scope.generateUid('_main')

              scope.rename('_main', mainUid)
            }
          }
        }
      },
      CallExpression(path) {
        if (args['--dev']) {
          const [source] = path.node.arguments

          if (
            path.node.callee.type === 'Import' &&
            source.type === 'StringLiteral'
          ) {
            path.node.type = 'CallExpression'
            path.node.callee = t.identifier(importUid)
            path.node.arguments = [
              t.newExpression(t.identifier('URL'), [
                t.stringLiteral(source.value),
                t.templateLiteral(
                  [
                    t.templateElement({
                      raw: 'https://',
                      cooked: 'https://'
                    }),
                    t.templateElement({raw: '/', cooked: '/'})
                  ],
                  [
                    t.memberExpression(
                      t.memberExpression(
                        t.identifier('window'),
                        t.identifier('location')
                      ),
                      t.identifier('host')
                    )
                  ]
                )
              ])
            ]
          }
        }
      }
    }
  }
}
