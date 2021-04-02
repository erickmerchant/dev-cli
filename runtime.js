const styles = {}
const modules = {}
const container = {}

const loadStyles = (url, css) => {
  const styleElement = styles[url]

  if (styleElement.nodeName === 'LINK') {
    const newStyleElement = document.createElement('style')

    newStyleElement.textContent = css

    styleElement.replaceWith(newStyleElement)

    styles[url] = newStyleElement
  } else {
    styleElement.textContent = css
  }
}

const loadModule = (url) => {
  const cacheBustedUrl = `${url}?${Date.now()}`

  return import(cacheBustedUrl).then((results) => {
    Object.assign(container, modules[url](results))
  })
}

const getUseCallback = (map) => (definitions) => {
  const results = {}

  for (const [key, val] of Object.entries(map)) {
    if (key === '*') {
      results[val] = definitions
    } else {
      results[val] = definitions[key]
    }
  }

  return results
}

export const use = async (
  url,
  callbackOrMap = (definitions) => definitions
) => {
  modules[url] =
    typeof callbackOrMap === 'object'
      ? getUseCallback(callbackOrMap)
      : callbackOrMap
}

export const run = async (init) => {
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

  let update = await init(container)

  if (update) {
    await update(container)
  } else {
    update = init
  }

  const handleChanges = async (changedFiles) => {
    changedFiles = Array.from(new Set(changedFiles))

    const promises = []

    for (const changed of changedFiles) {
      if (modules[`/${changed}`] != null) {
        promises.push(loadModule(`/${changed}`))
      }
    }

    const newStyles = {}

    for (const changed of changedFiles) {
      const url = `/${changed}`

      if (styles[url] != null) {
        promises.push(
          fetch(`${url}?${Date.now()}`).then(async (res) => {
            const css = await res.text()

            newStyles[url] = css
          })
        )
      }
    }

    await Promise.all(promises)

    for (const [url, css] of Object.entries(newStyles)) {
      loadStyles(url, css)
    }

    await update(container)
  }

  eventSource.onmessage = (e) => {
    const {files} = JSON.parse(e.data)

    handleChanges(files)
  }
}
