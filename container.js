const styleElements = {}

const loadStyles = async (url) => {
  let styleElement = styleElements[url]

  if (styleElement == null) {
    styleElement = document.createElement('style')

    document.head.append(styleElement)

    styleElements[url] = styleElement
  }

  const css = await fetch(`/${url}`)

  styleElement.textContent = await css.text()
}

export const createContainer = (modules, styles, start) => {
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
          return import(`/${source}`)
        }
      }
    } else if (Array.isArray(source)) {
      const [pattern, provide] = source

      service = {
        match(url) {
          return url.match(pattern)
        },
        provide
      }
    } else {
      throw TypeError('unsupported type for module provider')
    }

    modules[i] = service

    container.push(service.provide())
  }

  for (const style of styles) {
    loadStyles(style)
  }

  Promise.all(container).then((results) => {
    start(...results)
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

      for (const style of styles) {
        if (changed === style) {
          loadStyles(style)
        }
      }
    }

    timeoutSet = false

    changedFiles.splice(0, changedFiles.length)

    Promise.all(container).then((results) => {
      start(...results)
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
