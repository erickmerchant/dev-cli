import parse5 from 'parse5'

import {jsAsset} from './js-asset.js'
import {resolve} from './resolver.js'

export const htmlAsset = (args) => {
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

      if (node.tagName === 'link') {
        const href = node.attrs.find((attr) => attr.name === 'href')
        const rel = node.attrs.find((attr) => attr.name === 'rel')

        if (rel?.value === 'stylesheet') {
          if (href != null) {
            results.push({
              node: href,
              inline: false,
              type: 'css'
            })
          }
        }
      }

      results.push(...findNodes(node.childNodes || []))
    }

    return results
  }

  return {
    extensions: ['.html', '.htm'],
    contentType: 'text/html',
    async transform(code, meta) {
      code = String(code).trim()

      const method =
        code.substring(0, 9).toLowerCase() === '<!doctype'
          ? parse5.parse
          : parse5.parseFragment

      const ast = method(code)

      const nodes = findNodes(ast.childNodes ?? [])

      const promises = []

      for (const {node, inline, type} of nodes) {
        if (assets[type]) {
          if (inline) {
            promises.push(
              resolve(node.value, meta.pathname, meta).then((dependency) => {
                node.value = dependency

                if (meta.dependencies) {
                  meta.dependencies.push(dependency)
                }
              })
            )
          } else {
            const value = node.value

            promises.push(
              assets[type].transform(value, meta).then((value) => {
                node.value = value
              })
            )
          }
        } else if (meta.dependencies) {
          meta.dependencies.push(node.value)
        }
      }

      await Promise.all(promises)

      return parse5.serialize(ast)
    }
  }
}
