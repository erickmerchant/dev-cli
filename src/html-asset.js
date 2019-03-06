const path = require('path')
const parse5 = require('parse5')
const getImportPath = require('./get-import-path.js')

module.exports = (args) => {
  const cwd = process.cwd()
  const directories = [cwd, path.join(cwd, args.src)]

  const traverse = (nodes = []) => {
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

      traverse(node.childNodes)
    }
  }

  return {
    detect(code) {

    },
    src: args.src,
    extensions: ['.html', '.htm'],
    contentType: 'text/html',
    async transform(from, code) {
      const ast = parse5.parse(String(code))

      traverse(ast.childNodes)

      return parse5.serialize(ast)
    }
  }
}
