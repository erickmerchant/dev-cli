const styleElements = {}

const loadStyles = async (url) => {
  let styleElement = styleElements[url]

  if (styleElement.nodeName === 'LINK') {
    const newStyleElement = document.createElement('style')

    styleElement.replaceWith(newStyleElement)

    styleElements[url] = newStyleElement

    styleElement = newStyleElement
  }

  const now = Date.now()

  const css = await fetch(`${url}?${now}`)

  styleElement.textContent = await css.text()
}

export const createContainer = (modules, start) => {
  const container = []

  for (let i = 0; i < modules.length; i++) {
    const source = modules[i]
    let service

    if (typeof source === 'string') {
      service = {
        match(url) {
          return url === source
        },
        provide() {
          const now = Date.now()

          return import(`/${source}?${now}`)
        }
      }
    } else {
      throw TypeError('unsupported type for module provider')
    }

    modules[i] = service

    container.push(service.provide())
  }

  const linkRelStylesheets = document.querySelectorAll('link[rel="stylesheet"]')

  for (const linkRelStylesheet of linkRelStylesheets) {
    styleElements[linkRelStylesheet.getAttribute('href')] = linkRelStylesheet
  }

  Promise.all(container).then((results) => {
    start(Object.assign({}, ...results))
  })

  const eventSource = new EventSource('/__changes')

  let timeoutSet = false
  const changedFiles = []

  const handleChanges = async () => {
    for (const changed of Array.from(new Set(changedFiles))) {
      for (let i = 0; i < modules.length; i++) {
        const service = modules[i]

        if (service.match(changed)) {
          container[i] = service.provide()
        }
      }

      if (styleElements[`/${changed}`] != null) {
        loadStyles(`/${changed}`)
      }
    }

    timeoutSet = false

    changedFiles.splice(0, changedFiles.length)

    Promise.all(container).then((results) => {
      start(Object.assign({}, ...results))
    })
  }

  eventSource.onmessage = (e) => {
    const {file} = JSON.parse(e.data)

    changedFiles.push(file)

    if (!timeoutSet) {
      setTimeout(handleChanges, 100)

      timeoutSet = true
    }
  }
}
