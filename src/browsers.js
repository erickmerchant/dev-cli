const browserslist = require('browserslist')
const builtInEsm = require('@babel/preset-env/data/built-in-modules.json')['es6.module']
const defaults = browserslist()
const esmBrowsers = browserslist(Object.keys(builtInEsm).map((key) => `${key}>=${builtInEsm[key]}`).join(', '))

module.exports = defaults.filter((d) => esmBrowsers.includes(d)).join(', ')
