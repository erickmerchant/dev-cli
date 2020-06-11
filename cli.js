#!/usr/bin/env node --experimental-import-meta-resolve

const {command, start} = require('sergeant')('dev')
const serve = require('./serve.js')
const cache = require('./cache.js')

command({
  name: 'serve',
  signature: ['src'],
  options: {
    src: {
      description: 'where to serve files from',
      required: true,
      parameter: true
    },
    port: {
      description: 'the port to listen at',
      default: 3000,
      parameter: true
    },
    dev: {
      description: 'run in dev mode'
    },
    entry: {
      description: 'an alternate html to serve',
      default: 'index.html',
      parameter: true
    },
    p: 'port',
    d: 'dev',
    e: 'entry'
  },
  action: serve
})

command({
  name: 'cache',
  signature: ['src', 'dist'],
  options: {
    src: {
      description: 'where to cache files from',
      required: true,
      parameter: true
    },
    dist: {
      description: 'where to cache files to',
      required: true,
      parameter: true
    },
    dev: {
      description: 'run in dev mode'
    },
    d: 'dev'
  },
  action: cache
})

start(process.argv.slice(2))
