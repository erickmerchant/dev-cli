const path = require('path')
const parse5 = require('parse5')
const getImportPath = require('./get-import-path.js')

module.exports = (args) => {
  const cwd = process.cwd()
  const directories = [cwd, path.join(cwd, args.src)]

  const traverse = (nodes, cb = () => {}) => {
    for (const node of nodes) {
      if (node.tagName === 'link') {
        const rel = node.attrs.find((attr) => attr.name === 'rel')

        if (rel.value === 'stylesheet') {
          const href = node.attrs.find((attr) => attr.name === 'href')

          cb(href, 'css')
        }
      }

      if (node.tagName === 'script') {
        const type = node.attrs.find((attr) => attr.name === 'type')

        if (type.value === 'module') {
          const src = node.attrs.find((attr) => attr.name === 'src')

          cb(src, 'js')
        }
      }

      traverse(node.childNodes || [], cb)
    }
  }

  return {
    detect(code) {
      const ast = parse5.parseFragment(String(code))

      const results = []

      traverse(ast.childNodes || [], (attr) => {
        results.push(attr.value)
      })

      return results
    },
    src: args.src,
    extensions: ['.html', '.htm'],
    contentType: 'text/html',
    async transform(from, code) {
      const ast = parse5.parseFragment(String(code))

      traverse(ast.childNodes || [], (attr, type) => {
        if (type === 'css') {
          attr.value = getImportPath(attr.value, 'style', directories)
        }

        if (type === 'js') {
          attr.value = getImportPath(attr.value, 'module', directories)
        }
      })

      return parse5.serialize(ast)
    }
  }
}
