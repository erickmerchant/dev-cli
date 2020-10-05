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

export const runtime = async (run) => {
  const linkRelStylesheets = document.querySelectorAll('link[rel="stylesheet"]')

  for (const linkRelStylesheet of linkRelStylesheets) {
    styleElements[linkRelStylesheet.getAttribute('href')] = linkRelStylesheet
  }

  const eventSource = new EventSource('/__changes')

  let timeoutSet = false
  const changedFiles = []
  const container = {}

  const getGet = (filter = () => true, query = '') => async (...paths) => {
    const result = {}

    await Promise.all(
      paths
        .flat()
        .filter(filter)
        .map(async (path) => {
          const resolved = await import(`/${path}${query}`)

          container[path] = resolved
        })
    )

    for (const path of paths) {
      Object.assign(result, container[path])
    }

    return result
  }

  await run(getGet())

  const handleChanges = async () => {
    for (const changed of Array.from(new Set(changedFiles))) {
      if (styleElements[`/${changed}`] != null) {
        loadStyles(`/${changed}`)
      }
    }

    await run(getGet((path) => changedFiles.includes(path), `?${Date.now()}`))

    timeoutSet = false

    changedFiles.splice(0, changedFiles.length)
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
