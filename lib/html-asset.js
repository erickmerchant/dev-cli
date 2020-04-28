/* eslint-disable require-atomic-updates */

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
  const directories = [cwd, path.join(cwd, args.src)]

  const traverse = (nodes, cb = () => {}) => {
    const promises = []

    for (const node of nodes) {
      if (node.nodeName === '#text') {
        node.value = node.value.trim()
      }

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
    extensions: ['.html', '.htm', '.svg'],
    contentType: 'text/html',
    async transform(from, code, dependencies = []) {
      code = String(code).trim()

      const method = code.substring(0, 9).toLowerCase() === '<!doctype' ? parse5.parse : parse5.parseFragment

      const ast = method(code)

      await Promise.all(traverse(ast.childNodes || [], async (obj, inline, type) => {
        if (inline) {
          let browser

          if (type === 'css') {
            browser = 'style'
          }

          if (type === 'js') {
            browser = 'module'
          }

          if (browser) {
            const dependency = getImportPath(obj.value, browser, directories)

            obj.value = dependency

            dependencies.push(dependency)
          }
        } else if (assets[type]) {
          const value = obj.value

          obj.value = await assets[type].transform(from, value, dependencies)
        }
      }))

      return parse5.serialize(ast)
    }
  }
}
