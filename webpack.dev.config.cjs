const { merge } = require('webpack-merge');
const common = require('./webpack.config.cjs');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  
  output: {
    filename: '[name].js',
    chunkFilename: '[name].js',
    clean: false,
  },
  
  optimization: {
    minimize: false,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },

  plugins: [
    // Override MiniCssExtractPlugin for development
    ...common.plugins.filter(plugin => 
      plugin.constructor.name !== 'MiniCssExtractPlugin'
    ),
    new (require('mini-css-extract-plugin'))({
      filename: '[name].css',
      chunkFilename: '[name].css'
    }),
  ],

  stats: {
    preset: 'errors-warnings',
    assets: true,
    timings: true,
    builtAt: true,
  },
});