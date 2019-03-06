const path = require('path')

module.exports = (args) => {
  const cwd = process.cwd()
  const directories = [cwd, path.join(cwd, args.src)]

  return {
    detect (code) {

    },
    src: args.src,
    extensions: ['.html', '.htm'],
    contentType: 'text/html',
    async transform(from, code) {
      const ast = parse5.parse(String(code))

      this.traverse(ast.childNodes)

      return parse5.serialize(ast)
    },
    traverse (nodes = []) {
      for (const node of nodes) {
        if (node.tagName === 'link') {
          const rel = node.attrs.find((attr) => attr.name === 'rel')

          if (rel.value === 'stylesheet') {
            const href = node.attrs.find((attr) => attr.name === 'href')

            href.value = getImportPath(href.value, 'style', directories)
          }
        }

        if (node.tagName === 'script') {
          const type = node.attrs.find((attr) => attr.name === 'type')

          if (type.value === 'module') {
            const src = node.attrs.find((attr) => attr.name === 'src')

            src.value = getImportPath(src.value, 'module', directories)
          }
        }

        this.traverse(node.childNodes)
      }
    }
  }
}
