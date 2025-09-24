const path = require("path");

// Create webpack config with detailed stats for bundle analysis
const config = require("./webpack.config.cjs");

// Override stats for bundle analysis
config.stats = {
  preset: 'detailed',
  assets: true,
  chunks: true,
  modules: true,
  chunkModules: true,
  chunkOrigins: true,
  reasons: true,
  usedExports: true,
  providedExports: true,
  optimizationBailout: true,
  errorDetails: true,
  timings: true,
  builtAt: true
};

module.exports = config;