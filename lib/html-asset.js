const parse5 = require('parse5')
const jsAsset = require('./js-asset.js')
const cssAsset = require('./css-asset.js')

module.exports = (args, resolver) => {
  const assets = {
    css: cssAsset(args, resolver),
    js: jsAsset(args, resolver)
  }

  const findNodes = (nodes) => {
    const results = []

    for (const node of nodes) {
      if (node.nodeName === '#text') {
        node.value = node.value.trim()
      }

      if (node.tagName === 'link') {
        const rel = node.attrs.find((attr) => attr.name === 'rel')

        if (rel?.value === 'stylesheet') {
          const href = node.attrs.find((attr) => attr.name === 'href')

          if (href != null) {
            results.push({
              node: href,
              inline: true,
              type: 'css'
            })
          }
        }
      }

      if (node.tagName === 'style' && node?.childNodes?.[0] != null) {
        results.push({
          node: node.childNodes[0],
          inline: false,
          type: 'css'
        })
      }

      if (node.tagName === 'script') {
        const src = node.attrs.find((attr) => attr.name === 'src')
        const type = node.attrs.find((attr) => attr.name === 'type')

        if (type?.value === 'module') {
          if (src != null) {
            results.push({
              node: src,
              inline: true,
              type: 'js'
            })
          } else if (node?.childNodes?.[0] != null) {
            results.push({
              node: node.childNodes[0],
              inline: false,
              type: 'js'
            })
          }
        }
      }

      results.push(...findNodes(node.childNodes || []))
    }

    return results
  }

  return {
    extensions: ['.html', '.htm', '.svg'],
    contentType: 'text/html',
    async transform(from, code, dependencies = []) {
      code = String(code).trim()

      const method =
        code.substring(0, 9).toLowerCase() === '<!doctype'
          ? parse5.parse
          : parse5.parseFragment

      const ast = method(code)

      const nodes = findNodes(ast.childNodes || [])

      const promises = []

      for (const {node, inline, type} of nodes) {
        if (inline) {
          let browser

          if (type === 'css') {
            browser = 'style'
          }

          if (type === 'js') {
            browser = 'module'
          }

          if (browser) {
            const dependency = resolver(node.value)

            node.value = dependency

            dependencies.push(dependency)
          }
        } else if (assets[type]) {
          const value = node.value

          promises.push(
            assets[type].transform(from, value, dependencies).then((value) => {
              node.value = value
            })
          )
        }
      }

      await Promise.all(promises)

      return parse5.serialize(ast)
    }
  }
}
