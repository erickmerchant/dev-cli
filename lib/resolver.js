module.exports = (specifier) => {
  if (
    specifier.startsWith('/') ||
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('http://') ||
    specifier.startsWith('https://')
  ) {
    return specifier
  }

  return `/node_modules/${specifier}`
}
