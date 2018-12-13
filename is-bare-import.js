module.exports = (value) => {
  return !value.startsWith('.') && !value.startsWith('/')
}
