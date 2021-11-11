import compression from 'compression';
import devcert from 'devcert';
import {createSecureServer} from 'http2';
import proxy from 'http2-proxy';
import {gray, red} from 'kleur/colors';
import polka from 'polka';
import {URL} from 'url';

import {changeMiddleware} from './lib/change-middleware.js';
import {fileMiddleware} from './lib/file-middleware.js';
import {unfoundMiddleware} from './lib/unfound-middleware.js';

export const serve = async (args) => {
  const onError = (err, req, res) => {
    const url = new URL(req.url, 'https://localhost');

    console.error(err);

    res.writeHead(500);

    res.end('');

    console.log(`${gray('[dev]')} ${req.method} ${red(500)} ${url.pathname}`);
  };

  const options = await devcert.certificateFor('dev-cli.app');

  options.allowHTTP1 = true;

  const server = createSecureServer(options);

  const app = polka({server, onError});

  app.use(compression());

  app.use(changeMiddleware(args));

  app.use(fileMiddleware(args));

  if (args['--proxy']) {
    const proxyURL = new URL('/', args['--proxy']);

    app.use((req, res, next) => {
      proxy.web(
        req,
        res,
        {
          hostname: proxyURL.hostname,
          port: proxyURL.port,
          protocol: args['--proxy'].startsWith('https') ? 'https' : 'http',
          rejectUnauthorized: false,
          onRes: (req, res, proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);

            proxyRes.pipe(res);
          },
        },
        (err) => {
          if (err) {
            next(err);
          }
        }
      );
    });
  }

  app.use(unfoundMiddleware(args));

  app.listen(args['--port'] ?? 3000, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(
        `${gray('[dev]')} go to https://localhost:${args['--port'] ?? 3000}`
      );
    }
  });
};
