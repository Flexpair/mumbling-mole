const path = require("path");

// Create webpack config with detailed stats for bundle analysis
const baseConfig = require("./webpack.config.js");

module.exports = {
  ...baseConfig,
  stats: {
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
  }
};