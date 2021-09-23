import babel from '@babel/core';
import presetEnv from '@babel/preset-env';

import {createEntryPlugin} from './entry-plugin.js';
import {createImportsPlugin} from './imports-plugin.js';
import {find, resolve, runtimeId} from './resolver.js';
import {createTemplatesPlugin} from './templates-plugin.js';

const {transformFromAstAsync, parse, traverse} = babel;

export const jsAsset = {
  extensions: ['.mjs', '.js'],
  contentType: 'text/javascript',
  async transform(code, url, args) {
    const promises = [];
    const map = {};
    const {pathname} = await find(url.pathname, args.src);

    const parsed = parse(code);

    let isEntry = false;

    traverse(parsed, {
      ExportDeclaration(path) {
        const {node} = path;

        for (const s of node.specifiers) {
          if (s.exported.name === '_main') {
            isEntry = true;
          }
        }

        if (node.declaration) {
          for (const d of node.declaration.declarations) {
            if (d.id.name === '_main') {
              isEntry = true;
            }
          }
        }
      },
    });

    if (isEntry && args['--dev']) {
      promises.push(
        resolve(runtimeId, pathname).then(async (url) => {
          map[runtimeId] = {
            url,
          };
        })
      );
    }

    traverse(parsed, {
      'CallExpression'({node}) {
        const [source] = node.arguments;

        if (node.callee.type === 'Import' && source.type === 'StringLiteral') {
          promises.push(
            resolve(source.value, pathname).then(async (url) => {
              map[source.value] = {
                url,
              };
            })
          );
        }
      },
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'({node}) {
        if (node.source != null) {
          promises.push(
            resolve(node.source.value, pathname).then(async (url) => {
              const mapped = {
                url,
              };

              if (isEntry && args['--dev']) {
                mapped.specifiers = {};

                for (const specifier of node.specifiers) {
                  if (specifier.type === 'ImportNamespaceSpecifier') {
                    mapped.specifiers['*'] = specifier.local.name;
                  }

                  if (specifier.type === 'ImportSpecifier') {
                    mapped.specifiers[specifier.imported.name] =
                      specifier.local.name;
                  }

                  if (specifier.type === 'ImportDefaultSpecifier') {
                    mapped.specifiers['default'] = specifier.local.name;
                  }
                }
              }

              map[node.source.value] = mapped;
            })
          );
        }
      },
    });

    await Promise.all(promises);

    const plugins = [];

    if (isEntry) {
      plugins.push(createEntryPlugin(map, args));
    }

    plugins.push(createImportsPlugin(map), createTemplatesPlugin(map));

    const result = await transformFromAstAsync(parsed, code, {
      sourceType: 'module',
      sourceMaps: args['--dev'] ? 'inline' : false,
      sourceFileName: pathname,
      presets: [
        [
          presetEnv,
          {
            modules: false,
            targets: 'supports es6-module and defaults',
            bugfixes: true,
          },
        ],
      ],
      plugins,
    });

    return result.code;
  },
};
