import accepts from 'accepts';
import fs from 'fs/promises';
import {gray, yellow} from 'kleur/colors';

import {find} from './resolver.js';

export const unfoundMiddleware = (args) => async (req, res) => {
  const url = new URL(req.url, 'https://localhost');
  const reqAccepts = accepts(req);

  if (args['--entry'] && reqAccepts.type(['txt', 'html']) === 'html') {
    const {stats, pathname} = await find(args['--entry'], args['--src']);

    if (stats) {
      const html = await fs.readFile(pathname, 'utf8');

      const headers = {
        'Content-Type': 'text/html; charset=UTF-8',
      };

      res.writeHead(200, headers);

      res.end(html);

      return;
    }
  }

  res.writeHead(404);

  res.end('');

  console.log(`${gray('[dev]')} ${req.method} ${yellow(404)} ${url.pathname}`);
};
