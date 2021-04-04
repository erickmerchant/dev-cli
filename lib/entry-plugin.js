import t from '@babel/types'

import {isLocal, runtimeId} from './resolver.js'

export const createEntryPlugin = (map) => () => {
  let initUid
  let updateUid
  let runUid
  let useUid

  return {
    visitor: {
      'Program'(path) {
        runUid = path.scope.generateUid('run')
        useUid = path.scope.generateUid('use')

        path.unshiftContainer(
          'body',
          t.importDeclaration(
            [
              t.importSpecifier(t.identifier(runUid), t.identifier('run')),
              t.importSpecifier(t.identifier(useUid), t.identifier('use'))
            ],
            t.stringLiteral(runtimeId)
          )
        )
      },
      'VariableDeclarator'({node}) {
        if (
          updateUid != null &&
          node.id.name === updateUid &&
          !node.init.params.length
        ) {
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

          node.init.params.push(t.objectPattern(container))
        }
      },
      'CallExpression'(path) {
        if (updateUid && path.node.callee.name === updateUid) {
          for (const [key, val] of Object.entries(map)) {
            if (isLocal(key)) {
              const specifiers = []
              for (const [k, v] of Object.entries(val.specifiers)) {
                specifiers.push(
                  t.objectProperty(t.stringLiteral(k), t.stringLiteral(v))
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

          const callExpression = t.callExpression(t.identifier(runUid), [
            t.identifier(initUid)
          ])

          path.replaceWith(callExpression)

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
                    (n.callee.name === useUid || n.callee.name === runUid)
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
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path) {
        if (path.node.source != null) {
          if (
            path.node.source.value !== map[runtimeId].url &&
            isLocal(path.node.source.value)
          ) {
            path.remove()
          }
        }
      },
      'ExportDeclaration'(path) {
        const {node, scope} = path

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
  }
}
