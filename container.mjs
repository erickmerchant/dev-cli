export const createContainer = async (modules, styles, start) => {
  const styleElements = []
  const container = {}

  const loadJS = async (url, query = '') => {
    const result = await import(`/${url}${query}`)

    container[modules[url]] = result
  }

  const loadCSS = async (index, query = '') => {
    const css = await fetch(`/${styles[index]}${query}`)

    const stylesheet = styleElements[index]

    stylesheet.textContent = await css.text()
  }

  const promises = []

  for (const url of Object.keys(modules)) {
    promises.push(loadJS(url))
  }

  for (let i = 0; i < styles.length; i++) {
    const stylesheet = document.createElement('style')

    document.head.append(stylesheet)

    styleElements.push(stylesheet)

    promises.push(loadCSS(i))
  }

  await Promise.all(promises).then(() => start(container))

  const eventSource = new EventSource('/__changes')

  let timeoutSet = false
  const changedFiles = []

  const handleChanges = async () => {
    timeoutSet = false

    const query = `?${Date.now()}`
    const promises = []

    for (const file of Array.from(new Set(changedFiles))) {
      const styleIndex = styles.indexOf(file)

      if (styleIndex > -1) {
        promises.push(loadCSS(styleIndex, query))
      }

      if (modules[file]) {
        promises.push(loadJS(file, query))
      }
    }

    if (promises.length) {
      await Promise.all(promises)

      start(container)
    }
  }

  eventSource.onmessage = async (e) => {
    const {file} = JSON.parse(e.data)

    changedFiles.push(file)

    if (!timeoutSet) {
      setTimeout(handleChanges, 100)

      timeoutSet = true
    }
  }
}
