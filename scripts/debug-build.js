/* Minimal programmatic webpack runner to print detailed errors/warnings and emitted assets. */
const path = require('path');
const webpack = require('webpack');
const config = require(path.join(__dirname, '..', 'webpack.config.js'));

webpack(config, (err, stats) => {
  if (err) {
    console.error('[webpack:error]', err.stack || err.message || err);
    if (err.details) console.error(err.details);
    process.exit(2);
    return;
  }
  const info = stats.toJson({ all: false, errors: true, warnings: true, assets: true, timings: true });
  console.log('[done] hasErrors=%s hasWarnings=%s', stats.hasErrors(), stats.hasWarnings());
  if (info.assets && info.assets.length) {
    for (const a of info.assets) console.log('asset', a.name, a.size || a.info?.size || 0);
  } else {
    console.log('no assets emitted');
  }
  if (info.warnings && info.warnings.length) {
    console.warn('\nWarnings:');
    for (const w of info.warnings) console.warn(w.message || w);
  }
  if (info.errors && info.errors.length) {
    console.error('\nErrors:');
    for (const e of info.errors) console.error(e.message || e);
  }
  if (stats.hasErrors()) process.exit(1);
});
