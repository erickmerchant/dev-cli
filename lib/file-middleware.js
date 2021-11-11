import fs from 'fs/promises';
import {gray, green} from 'kleur/colors';
import mime from 'mime-types';
import path from 'path';

import {jsAsset} from './js-asset.js';
import {find} from './resolver.js';

const etagSuffix = Date.now().toString(16);

export const fileMiddleware = (args) => async (req, res, next) => {
  const url = new URL(req.url, 'https://localhost');
  const {stats, pathname} = await find(url.pathname, args['--src']);

  if (!stats) {
    next();

    return;
  }

  const etag = `W/"${stats.size.toString(16)}-${stats.mtime
    .getTime()
    .toString(16)}-${etagSuffix}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304);

    res.end('');

    console.log(`${gray('[dev]')} ${req.method} ${green(304)} ${url.pathname}`);
  } else {
    let code = await fs.readFile(pathname);

    let transform = false;

    if (jsAsset.extensions.includes(path.extname(pathname))) {
      transform = true;
    }

    if (transform) {
      code = await jsAsset.transform(String(code), url, args);
    }

    const contentType = mime.contentType(path.extname(pathname));

    const headers = {
      'ETag': etag,
      'Content-Type': contentType,
    };

    res.writeHead(200, headers);

    res.end(code);

    console.log(
      `${gray('[dev]')} ${req.method} ${green(200)} ${url.pathname} ${gray(
        contentType
      )}`
    );
  }
};
