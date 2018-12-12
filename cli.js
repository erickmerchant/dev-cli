#!/usr/bin/env node

const command = require('sergeant')
const serve = require('./serve.js')
const copy = require('./copy.js')
const out = process.stdout

command('dev', ({ command }) => {
  command('serve', ({ option, parameter }) => {
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

    return (args) => serve({
      out
    })(args)
  })

  command('copy', ({ option, parameter }) => {
    parameter('src', {
      description: 'where to copy files from',
      type (val = './src/') {
        return val
      }
    })

    parameter('dist', {
      description: 'where to copy files to',
      type (val = './src/') {
        return val
      }
    })

    option('dev', {
      description: 'run in dev mode'
    })

    return (args) => copy({
      out
    })(args)
  })
})(process.argv.slice(2))
