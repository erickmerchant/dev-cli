module.exports = (value) => !value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('.') && !value.startsWith('/')
