#!/usr/bin/env node --experimental-import-meta-resolve

import sergeant from 'sergeant'
import serve from './serve.js'
import cache from './cache.js'

const {start, command} = sergeant('dev')

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
