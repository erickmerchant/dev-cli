const styles = {}
const modules = {}
const container = {}

const loadStyles = (url, css) => {
  const styleElement = styles[url]

  if (styleElement.nodeName === 'LINK') {
    const newStyleElement = document.createElement('style')

    if (styleElement.hasAttribute('media')) {
      newStyleElement.setAttribute('media', styleElement.getAttribute('media'))
    }

    newStyleElement.textContent = css

    styleElement.replaceWith(newStyleElement)

    styles[url] = newStyleElement
  } else {
    styleElement.textContent = css
  }
}

const loadModule = (url, bust = true) => {
  return import(`${url}${bust ? `?${Date.now()}` : ''}`).then((results) => {
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

export const use = async (url, map, initial) => {
  modules[url] = getUseCallback(map)

  Object.assign(container, initial)
}

export const run = async (update) => {
  const linkRelStylesheets = document.querySelectorAll('link[rel="stylesheet"]')

  for (const linkRelStylesheet of linkRelStylesheets) {
    styles[linkRelStylesheet.href] = linkRelStylesheet
  }

  const eventSource = new EventSource('/_changes')

  const promises = []

  for (const url of Object.keys(modules)) {
    promises.push(loadModule(url, false))
  }

  await Promise.all(promises)

  if (update) {
    await update(container)
  }

  const handleChanges = async (changedFiles) => {
    changedFiles = Array.from(new Set(changedFiles))

    const stylePromises = []

    const newStyles = {}

    for (const changed of changedFiles) {
      const url = changed

      if (styles[url] != null) {
        stylePromises.push(
          fetch(`${url}?${Date.now()}`).then(async (res) => {
            const css = await res.text()

            newStyles[url] = css
          })
        )
      }
    }

    await Promise.all(stylePromises)

    const modulePromises = []

    for (const changed of changedFiles) {
      if (modules[changed] != null) {
        modulePromises.push(loadModule(changed))
      }
    }

    await Promise.all(modulePromises)

    await update(container)

    for (const [url, css] of Object.entries(newStyles)) {
      loadStyles(url, css)
    }
  }

  eventSource.onmessage = (e) => {
    let {files} = JSON.parse(e.data)

    files = files.map((url) => new URL(url, `http://${window.location.host}/`))

    handleChanges(files)
  }
}
