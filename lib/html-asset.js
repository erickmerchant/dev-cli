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
    async detect(code) {
      const ast = parse5.parse(String(code))

      const results = []

      await Promise.all(traverse(ast.childNodes || [], async (obj, inline, type) => {
        if (inline) {
          results.push(obj.value)
        } else if (assets[type]) {
          results.push(...await assets[type].detect(obj.value))
        }
      }))

      return results
    },
    extensions: ['.html', '.htm'],
    contentType: 'text/html',
    async transform(from, code) {
      const ast = parse5.parse(String(code))

      await Promise.all(traverse(ast.childNodes || [], async (obj, inline, type) => {
        if (inline) {
          if (type === 'css') {
            obj.value = getImportPath(obj.value, 'style', directories)
          }

          if (type === 'js') {
            obj.value = getImportPath(obj.value, 'module', directories)
          }
        } else if (assets[type]) {
          const value = obj.value

          obj.value = await assets[type].transform(from, value)
        }
      }))

      return parse5.serialize(ast)
    }
  }
}
