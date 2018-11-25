#!/usr/bin/env node

const command = require('sergeant')
const serve = require('./serve.js')
const out = process.stdout

command('dev', ({ command }) => {
  command('serve', ({ option, parameter }) => {
    parameter('directory', {
      description: 'the directory to serve files from',
      type (val = '.') {
        return val
      }
    })

    option('port', {
      description: 'the port to listen at',
      type (val = 3000) {
        return val ? Number(val) : null
      }
    })

    option('dev', {
      description: 'run in dev mode'
    })

    return (args) => serve({ out })(args)
  })
})(process.argv.slice(2))
