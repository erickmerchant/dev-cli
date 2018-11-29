#!/usr/bin/env node

const command = require('sergeant')
const serve = require('./serve.js')
const cache = require('./cache.js')
const out = process.stdout

command('dev', ({ command }) => {
  command('serve', ({ option, parameter }) => {
    sharedOptionsParameters({ option, parameter })

    return (args) => serve({
      out
    })(args)
  })

  command('cache', ({ option, parameter }) => {
    sharedOptionsParameters({ option, parameter })

    parameter('dist', {
      description: 'where to cache files to',
      type (val = './src/') {
        return val
      }
    })

    return (args) => cache({
      out
    })(args)
  })
})(process.argv.slice(2))

function sharedOptionsParameters ({ option, parameter }) {
  parameter('src', {
    description: 'where to serve files from',
    type (val = './src/') {
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
}
