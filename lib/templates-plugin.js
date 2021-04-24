import t from '@babel/types'

export const createTemplatesPlugin = () => () => {
  return {
    visitor: {
      Program(path) {
        path.traverse({
          TemplateElement(path) {
            const parent = path.findParent((path) =>
              path.isTaggedTemplateExpression()
            )

            if (parent?.node?.tag?.name === 'html') {
              const value = path.node.value

              const raw = value.raw
                .replace(/\s+/g, ' ')
                .replace(/(> <|> $| >|^ <|< )/g, (match) =>
                  match.replace(/\s/g, '')
                )

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
      }
    }
  }
}
