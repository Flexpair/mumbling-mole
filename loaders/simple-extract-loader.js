const path = require('path');
const vm = require('vm');
const resolve = require('resolve');

module.exports = function simpleExtractLoader(source) {
  const callback = this.async();
  this.cacheable();

  const publicPath = getPublicPath(this);

  evalDependencyGraph({
    loaderContext: this,
    src: source,
    filename: this.resourcePath,
    publicPath,
  })
    .then((result) => callback(null, result))
    .catch((error) => callback(error));
};

async function evalDependencyGraph({ loaderContext, src, filename, publicPath }) {
  const moduleCache = new Map();

  async function evalModule(code, requestFilename) {
    if (moduleCache.has(requestFilename)) {
      return moduleCache.get(requestFilename);
    }

    const newDependencies = [];
    const moduleExports = { exports: {} };

    const sandbox = Object.assign({}, global, {
      module: moduleExports,
      exports: moduleExports.exports,
      __esbuild_public_path__: publicPath,
      Buffer,
      process,
      console,
      require(request) {
        const { loaders, absolutePath, query } = resolveRequest(requestFilename, request);

        if (!loaders && path.extname(absolutePath) === '.js') {
          loaderContext.addDependency(absolutePath);
          if (moduleCache.has(absolutePath)) {
            return moduleCache.get(absolutePath);
          }

          // Use Node's require for plain JS modules
          const exports = require(absolutePath);
          moduleCache.set(absolutePath, exports);
          return exports;
        }

        const placeholder = createPlaceholder();
        newDependencies.push({
          absoluteRequest: `${loaders}${absolutePath}${query}`,
          placeholder,
        });
        return placeholder;
      },
    });

    const script = new vm.Script(code, {
      filename: requestFilename,
      displayErrors: true,
    });

    const context = vm.createContext(sandbox);
    script.runInContext(context);

    const dependencyContents = await Promise.all(
      newDependencies.map(({ absoluteRequest }) =>
        loadModule(loaderContext, absoluteRequest).then((result) => {
          const requestPath = absoluteRequest.split('!').pop();
          return evalModule(result, requestPath);
        })
      )
    );

    let content = extractExports(moduleExports.exports);
    dependencyContents.forEach((dependencyContent, index) => {
      const pattern = new RegExp(newDependencies[index].placeholder, 'g');
      content = content.replace(pattern, dependencyContent);
    });

    moduleCache.set(requestFilename, content);
    return content;
  }

  return evalModule(src, filename);
}

function resolveRequest(fromFilename, request) {
  const queryIndex = request.lastIndexOf('?');
  const query = queryIndex >= 0 ? request.slice(queryIndex) : '';
  const requestWithoutQuery = queryIndex >= 0 ? request.slice(0, queryIndex) : request;
  const loaderIndex = requestWithoutQuery.lastIndexOf('!');
  const loaders = loaderIndex >= 0 ? requestWithoutQuery.slice(0, loaderIndex + 1) : '';
  const resourcePath = requestWithoutQuery.slice(loaderIndex + 1) || requestWithoutQuery;
  const absolutePath = resolve.sync(resourcePath, {
    basedir: path.dirname(fromFilename),
  });

  return { loaders, absolutePath, query };
}

function loadModule(loaderContext, request) {
  return new Promise((resolvePromise, rejectPromise) => {
    loaderContext.loadModule(request, (error, source) => {
      if (error) {
        rejectPromise(error);
      } else {
        resolvePromise(source);
      }
    });
  });
}

function extractExports(exports) {
  if (typeof exports === 'string') {
    return exports;
  }
  if (exports && typeof exports === 'object') {
    if (typeof exports.default === 'string' && Object.keys(exports).length === 1) {
      return exports.default;
    }
    if (typeof exports.toString === 'function') {
      return exports.toString();
    }
  }
  throw new Error('The module did not export a string.');
}

function createPlaceholder() {
  return `__EXTRACT_PLACEHOLDER__${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}`;
}

function getPublicPath(loaderContext) {
  if (loaderContext._compilation && loaderContext._compilation.outputOptions) {
    const { publicPath } = loaderContext._compilation.outputOptions;
    if (typeof publicPath === 'string') {
      return publicPath;
    }
  }

  if (loaderContext.options && loaderContext.options.output && loaderContext.options.output.publicPath) {
    return loaderContext.options.output.publicPath;
  }

  return '';
}
