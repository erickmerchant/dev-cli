# @erickmerchant/dev-cli

A CLI that can run a development server or build a static site for deployment.

- hot module reloading via a server-sent events and a client-side ioc container
- post and delete json to implement content edit UIs for development
- uses @babel/preset-env with targets esmodules true
- minifies with terser
- uses import.meta.resolve to resolve imports
- use bare imports even in html

```
npx @erickmerchant/dev-cli --help
```
