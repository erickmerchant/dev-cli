# @erickmerchant/dev-cli

A cli that can run a development server or build a site for deployment. Prioritizes speed and simplicity without sacrificing dependency managment and transpilation.

Install npm packages that use JS modules. Write your code referencing bare imports (even in your html). Run the serve command and it will modify those imports to work in the browser. JS modules can be referenced by the module property in a package's package.json. Also works with CSS, which can use the style property. Automatically runs babel with babel-preset-env and postcss cssnano. The cache command will save the responses that are served to files to be uploaded to a static host.

## Usage

Install it globally or just use npx.

```
npx @erickmerchant/dev-cli --help
```
