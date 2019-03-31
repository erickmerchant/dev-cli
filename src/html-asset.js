const path = require('path')
const parse5 = require('parse5')
const getImportPath = require('./get-import-path.js')
const jsAsset = require('./js-asset.js')
const cssAsset = require('./css-asset.js')

module.exports = (args) => {
  const assets = {
    css: cssAsset(args),
    js: jsAsset(args)
  }
  const cwd = process.cwd()

  const traverse = (nodes, cb = () => {}) => {
    const promises = []

    for (const node of nodes) {
      if (node.tagName === 'link') {
        const rel = node.attrs.find((attr) => attr.name === 'rel')

        if (rel != null && rel.value === 'stylesheet') {
          const href = node.attrs.find((attr) => attr.name === 'href')

          if (href != null) promises.push(cb(href, true, 'css'))
        }
      }

      if (node.tagName === 'style' && node.childNodes != null && node.childNodes[0] != null) {
        promises.push(cb(node.childNodes[0], false, 'css'))
      }

      if (node.tagName === 'script') {
        const src = node.attrs.find((attr) => attr.name === 'src')
        const type = node.attrs.find((attr) => attr.name === 'type')

        if (type != null && type.value === 'module') {
          if (src != null) {
            promises.push(cb(src, true, 'js'))
          } else if (node.childNodes != null && node.childNodes[0] != null) {
            promises.push(cb(node.childNodes[0], false, 'js'))
          }
        }
      }

      promises.push(...traverse(node.childNodes || [], cb))
    }

    return promises
  }

  return {
    src: args.src,
    extensions: ['.html', '.htm'],
    contentType: 'text/html',
    async transform(from, code) {
      const ast = parse5.parse(String(code))
      const dependencies = []

      await Promise.all(traverse(ast.childNodes || [], async (obj, inline, type) => {
        if (inline) {
          let importPath

          if (type === 'css') {
            importPath = getImportPath(from, obj.value, 'style')
          }

          if (type === 'js') {
            importPath = getImportPath(from, obj.value, 'module')
          }

          dependencies.push(importPath)

          obj.value = importPath
        } else if (assets[type]) {
          const value = obj.value

          const transformed = await assets[type].transform(from, value)

          obj.value = transformed.code

          dependencies.push(...transformed.dependencies)
        }
      }))

      return {
        dependencies,
        code: parse5.serialize(ast)
      }
    }
  }
}
