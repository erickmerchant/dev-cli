# @erickmerchant/dev-cli

A CLI that can run a development server or build a static site for deployment.

- hot module reloading via a server-sent events and a client-side ioc container
- RESTful json to implement content edit UIs for development
- uses @babel/preset-env targeting modules
- uses import.meta.resolve to find modules
- minifies html template literals

```
npx @erickmerchant/dev-cli --help
```
