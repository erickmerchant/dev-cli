const styleElements = {}

export const cssService = (url) => {
  return {
    match(changed) {
      return changed === url
    },

    async provide(container) {
      let styleElement = styleElements[url]

      if (styleElement == null) {
        styleElement = document.createElement('style')

        document.head.append(styleElement)

        styleElements[url] = styleElement
      }

      const css = await fetch(`/${url}?${Date.now()}`)

      styleElement.textContent = await css.text()
    }
  }
}

export const jsService = (url, key) => {
  return {
    match(changed) {
      return changed === url
    },

    async provide(container) {
      const result = await import(`/${url}?${Date.now()}`)

      container[key] = result
    }
  }
}

export const createService = (match, provide) => {
  return {match, provide}
}

export const createContainer = async (services, start) => {
  const container = {}

  const promises = []

  for (const service of services) {
    promises.push(service.provide(container))
  }

  await Promise.all(promises).then(() => start(container))

  const eventSource = new EventSource('/__changes')

  let timeoutSet = false
  const changedFiles = []

  const handleChanges = async () => {
    const promises = []

    for (const url of Array.from(new Set(changedFiles))) {
      for (const service of services) {
        if (service.match(url)) {
          promises.push(service.provide(container))
        }
      }
    }

    timeoutSet = false

    changedFiles.splice(0, changedFiles.length)

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
