const styles = {}
const modules = {}
const container = {}

const loadStyles = async (url) => {
  let styleElement = styles[url]

  if (styleElement.nodeName === 'LINK') {
    const newStyleElement = document.createElement('style')

    styleElement.replaceWith(newStyleElement)

    styles[url] = newStyleElement

    styleElement = newStyleElement
  }

  const css = await fetch(`${url}?${Date.now()}`)

  styleElement.textContent = await css.text()
}

const loadModule = (url) =>
  import(`${url}?${Date.now()}`).then((results) => {
    Object.assign(container, modules[url](results))
  })

const getUseCallback = (map) => (exports) => {
  const results = {}

  for (const [key, val] of Object.entries(map)) {
    if (key === '*') {
      results[val] = exports
    } else {
      results[val] = exports[key]
    }
  }

  return results
}

export const use = async (url, callbackOrMap) => {
  modules[url] =
    typeof callbackOrMap === 'object'
      ? getUseCallback(callbackOrMap)
      : callbackOrMap
}

export const run = async (start) => {
  const linkRelStylesheets = document.querySelectorAll('link[rel="stylesheet"]')

  for (const linkRelStylesheet of linkRelStylesheets) {
    styles[linkRelStylesheet.getAttribute('href')] = linkRelStylesheet
  }

  const eventSource = new EventSource('/__changes')

  const promises = []

  for (const url of Object.keys(modules)) {
    promises.push(loadModule(url))
  }

  await Promise.all(promises)

  await start(container)

  const handleChanges = async (changedFiles) => {
    changedFiles = Array.from(new Set(changedFiles))

    const promises = []

    for (const changed of changedFiles) {
      if (modules[`/${changed}`] != null) {
        promises.push(loadModule(`/${changed}`))
      }
    }

    await Promise.all(promises)

    await start(container)

    for (const changed of changedFiles) {
      if (styles[`/${changed}`] != null) {
        loadStyles(`/${changed}`)
      }
    }
  }

  eventSource.onmessage = (e) => {
    const {files} = JSON.parse(e.data)

    handleChanges(files)
  }
}
