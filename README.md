# @erickmerchant/dev-cli

A CLI that can run a development server or build a static site for deployment. Prioritizes speed and simplicity without sacrificing dependency management and using the latest features of javascript.

Install npm packages that use ES modules. Write your code referencing bare imports (even in your html). Run the serve command and it will modify those imports to work in the browser. ES modules can be referenced by the module property in a package's package.json. Also works with CSS, which can use the style property. Automatically runs babel with @babel/preset-modules and postcss with cssnano. The cache command will save the responses to files to be uploaded to a static host.

## Usage

Install it globally or just use npx.

```
npx @erickmerchant/dev-cli --help
```
