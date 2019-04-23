#!/usr/bin/env node

const {command, start} = require('sergeant')('dev')
const serve = require('./serve.js')
const cache = require('./cache.js')

command(['serve'], ({option, parameter}) => {
  parameter({
    name: 'src',
    description: 'where to serve files from',
    required: true,
    type(val) {
      return val
    }
  })

  option({
    name: 'port',
    description: 'the port to listen at',
    type(val = 3000) {
      return val ? Number(val) : null
    },
    alias: 'p'
  })

  option({
    name: 'dev',
    description: 'run in dev mode',
    alias: 'd'
  })

  return (args) => serve({console})(args)
})

command(['cache'], ({option, parameter}) => {
  parameter({
    name: 'src',
    description: 'where to cache files from',
    required: true,
    type(val) {
      return val
    }
  })

  parameter({
    name: 'dist',
    description: 'where to cache files to',
    required: true,
    type(val) {
      return val
    }
  })

  option({
    name: 'dev',
    description: 'run in dev mode',
    alias: 'd'
  })

  return (args) => cache({console})(args)
})

start(process.argv.slice(2))
