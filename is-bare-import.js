module.exports = function (value) {
  return !value.startsWith('.') && !value.startsWith('/')
}
