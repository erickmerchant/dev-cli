#!/usr/bin/env node

const command = require('sergeant')
const serve = require('./serve.js')
const cache = require('./cache.js')
const out = process.stdout

command('dev', 'run a development server or cache responses, automatically running babel and postcss', ({command}) => {
  command('serve', ({option, parameter}) => {
    parameter('src', {
      description: 'where to serve files from',
      required: true,
      type(val) {
        return val
      }
    })

    option('port', {
      description: 'the port to listen at',
      type(val = 3000) {
        return val ? Number(val) : null
      },
      alias: 'p'
    })

    option('dev', {
      description: 'run in dev mode',
      alias: 'd'
    })

    return (args) => serve({
      out
    })(args)
  })

  command('cache', ({option, parameter}) => {
    parameter('src', {
      description: 'where to cache files from',
      required: true,
      type(val) {
        return val
      }
    })

    parameter('dist', {
      description: 'where to cache files to',
      required: true,
      type(val) {
        return val
      }
    })

    option('dev', {
      description: 'run in dev mode',
      alias: 'd'
    })

    return (args) => cache({
      out
    })(args)
  })
})(process.argv.slice(2))
