#!/usr/bin/env node

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
    importmap: {
      description: 'an importmap',
      parameter: true
    },
    p: 'port',
    d: 'dev',
    m: 'importmap'
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
    importmap: {
      description: 'an importmap',
      parameter: true
    },
    d: 'dev',
    m: 'importmap'
  },
  action: cache
})

start(process.argv.slice(2))
