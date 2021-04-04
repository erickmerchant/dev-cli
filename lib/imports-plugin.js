export const createImportsPlugin = (map) => () => {
  return {
    visitor: {
      'CallExpression'(path) {
        const [source] = path.node.arguments

        if (
          path.node.callee.type === 'Import' &&
          source.type === 'StringLiteral' &&
          map[source.value]
        ) {
          source.value = map[source.value].url
        }
      },
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path) {
        if (path.node.source != null) {
          if (map[path.node.source.value]) {
            path.node.source.value = map[path.node.source.value].url
          }
        }
      }
    }
  }
}
