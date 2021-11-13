import chokidar from 'chokidar';
import {gray, green} from 'kleur/colors';
import path from 'path';

export const changeMiddleware = (args) => async (req, res) => {
  const url = new URL(req.url, 'https://localhost');

  if (req.headers.accept === 'text/event-stream') {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      // 'Connection': 'keep-alive'
    };

    res.writeHead(200, headers);

    const changedFiles = [];
    let timeout;

    const getWatchCallback = (base) => (type, file) => {
      changedFiles.push(path.relative(base, file));

      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(
        () =>
          res.write(
            `data: ${JSON.stringify({
              files: changedFiles.splice(0, changedFiles.length),
            })}\n\n`
          ),
        500
      );
    };

    chokidar
      .watch(path.join(process.cwd(), args['--src']), {ignoreInitial: true})
      .on('all', getWatchCallback(path.join(process.cwd(), args['--src'])));

    res.write(`\n\n`);

    console.log(
      `${gray('[dev]')} ${req.method} ${green(200)} ${url.pathname} ${gray(
        'text/event-stream'
      )}`
    );
  }
};
