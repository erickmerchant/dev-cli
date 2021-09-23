import 'construct-style-sheets-polyfill';

const styles = {};
const modules = {};
const counters = {};
const container = {};

const getURL = (url) => `${url}?${counters[url] ?? 0}`;

const loadStyle = (url) =>
  fetch(getURL(url)).then(async (res) => {
    const css = await res.text();

    await styles[url].replace(css);
  });

const loadModule = (url) =>
  import(getURL(url)).then((results) => {
    Object.assign(container, modules[url](results));
  });

const getUseCallback = (map) => (definitions) => {
  const results = {};

  for (const [key, val] of Object.entries(map)) {
    if (key === '*') {
      results[val] = definitions;
    } else {
      results[val] = definitions[key];
    }
  }

  return results;
};

export const use = async (url, map, initial) => {
  modules[url] = getUseCallback(map);

  Object.assign(container, initial);
};

export const run = async (update, selfURL) => {
  const linkRelStylesheets = document.querySelectorAll(
    'link[rel="stylesheet"]'
  );

  const promises = [];

  for (const linkRelStylesheet of linkRelStylesheets) {
    styles[linkRelStylesheet.href] = new CSSStyleSheet();

    promises.push(
      loadStyle(linkRelStylesheet.href).then(() => {
        document.adoptedStyleSheets = [
          ...document.adoptedStyleSheets,
          styles[linkRelStylesheet.href],
        ];

        linkRelStylesheet.remove();
      })
    );
  }

  const eventSource = new EventSource('/_changes');

  for (const url of Object.keys(modules)) {
    promises.push(loadModule(url));
  }

  await Promise.all(promises);

  if (update) {
    await update(container);

    const handleChanges = async (changedFiles) => {
      changedFiles = Array.from(new Set(changedFiles));

      const promises = [];

      for (const changed of changedFiles) {
        if (changed.href === selfURL.href) {
          window.location.reload();
        }

        if (styles[changed] != null) {
          promises.push(loadStyle(changed));
        }

        if (modules[changed] != null) {
          promises.push(loadModule(changed));
        }
      }

      await Promise.all(promises);

      await update(container);
    };

    eventSource.onmessage = (e) => {
      const {files} = JSON.parse(e.data);

      for (let i = 0; i < files.length; i++) {
        files[i] = new URL(files[i], `https://${window.location.host}/`);

        const val = counters[files[i]];

        counters[files[i]] = val != null ? val + 1 : 1;
      }

      handleChanges(files);
    };
  }
};

export const _import = (url) => import(getURL(url));
