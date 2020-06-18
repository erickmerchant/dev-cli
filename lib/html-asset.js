import parse5 from 'parse5'
import jsAsset from './js-asset.js'

export default (args) => {
  const assets = {
    js: jsAsset(args)
  }

  const findNodes = (nodes) => {
    const results = []

    for (const node of nodes) {
      if (node.nodeName === '#text') {
        node.value = node.value.trim()
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
    async transform(from, code) {
      const {resolve} = await import('./resolver.js')

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
          promises.push(
            resolve(node.value, from, args.src).then((dependency) => {
              node.value = dependency
            })
          )
        } else if (assets[type]) {
          const value = node.value

          promises.push(
            assets[type].transform(from, value).then((value) => {
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
