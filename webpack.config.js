const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
// Added Node polyfills + ProvidePlugin/DefinePlugin to fix runtime 'process is not defined'
// after upgrading dependencies; keeps vendored mumble-client utils working.

var path = require("path");

module.exports = {
  mode: "production",
  entry: {
    index: ["./app/index.js"], // HTML now handled by HtmlWebpackPlugin template
    config: "./app/config.js",
    theme: "./app/theme.js",
  },
  devtool: false,
  resolve: {
    alias: {
      // Eliminate duplicate bn.js dependencies by forcing a single version
      'bn.js': require.resolve('bn.js'),
      // Also optimize other common duplicates
      'buffer': require.resolve('buffer'),
      'events': require.resolve('events'),
      'util': require.resolve('util'),
      'stream': require.resolve('stream-browserify'),
    }
  },
  stats: {
    preset: 'minimal',
    assets: true,
    chunks: false,
    modules: false,
    timings: true,
    builtAt: true
  },
  output: {
    path: path.join(__dirname, "dist"),
    chunkFilename: "[chunkhash].js",
    filename: "[name].js",
    publicPath: "",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
            plugins: ["@babel/plugin-transform-runtime"],
          },
        },
      },
      // HTML now processed via HtmlWebpackPlugin (see plugins section)
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { esModule: false } }
        ]
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { esModule: false } },
          { loader: 'sass-loader' }
        ]
      },
      {
        type: "javascript/auto",
        test: /manifest\.json$|\.xml$/,
        use: [
          {
            loader: "file-loader",
            options: {
              esModule: false,
            },
          },
          {
            loader: "extract-loader",
          },
          {
            loader: "regexp-replace-loader",
            options: {
              match: {
                pattern: "#require\\('([^']*)'\\)",
                flags: "g",
              },
              replaceWith: '"+require("$1")+"',
            },
          },
          {
            loader: "raw-loader",
            options: {
              esModule: false,
            },
          },
        ],
      },
      {
        test: /\.(svg|png|ico)$/,
        use: [
          {
            loader: "file-loader",
            options: {
              esModule: false,
            },
          },
        ],
      },
      {
        // Worker files are referenced via new Worker(new URL('./worker.js', import.meta.url))
        // so no special loader is required (Webpack 5 supports this natively).
        test: /worker\.js$/,
        type: 'javascript/auto',
      },
      {
        enforce: "post",
        test: /mumble-streams\/lib\/data.js/,
        use: ["transform-loader?brfs"],
      },
    ],
  },
  target: "web",
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Large libraries get their own chunks
        opus: {
          test: /[\\/]node_modules[\\/]libopus\.js/,
          name: 'opus',
          chunks: 'all',
          priority: 30,
        },
        protobuf: {
          test: /[\\/]node_modules[\\/]protobufjs[\\/]|[\\/]vendors[\\/]mumble-client[\\/]node_modules[\\/]protobufjs/,
          name: 'protobuf',
          chunks: 'all',
          priority: 25,
        },
        crypto: {
          test: /[\\/]node_modules[\\/](crypto-browserify|create-ecdh|diffie-hellman|public-encrypt|elliptic|asn1\.js|bn\.js)/,
          name: 'crypto',
          chunks: 'all',
          priority: 20,
        },
        streams: {
          test: /[\\/]node_modules[\\/](stream-browserify|readable-stream|through2|mumble-streams)/,
          name: 'streams',  
          chunks: 'all',
          priority: 15,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
      },
    },
    // Enable tree shaking for better dead code elimination  
    usedExports: true,
    sideEffects: false,
  },
  resolve: {
    // Explicit fallbacks ensure consistent behavior regardless of node-polyfill-webpack-plugin
    // internal alias changes across major versions.
    fallback: {
      buffer: require.resolve('buffer/'),
      util: require.resolve('util/'),
      process: require.resolve('process/browser'),
    }
  },
  plugins: [
    // Polyfills: keep explicit Provide/Define for stable globals; include any additionalAliases from lite if needed
    new NodePolyfillPlugin({ additionalAliases: ["process"] }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: ['process/browser']
    }),
    new webpack.DefinePlugin({
      'process.browser': 'true'
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css'
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(__dirname, 'app/index.html'),
      inject: false,
      minify: { removeComments: false },
      templateParameters: (compilation, assets) => ({ assets })
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'app/favicons', to: 'favicons' },
        { from: 'themes/MetroMumbleLight/svg', to: 'svg' },
        { from: 'themes/MetroMumbleLight/img', to: 'img' }
      ]
    }),
    new webpack.ProgressPlugin({
      activeModules: true,
      entries: true,
      modules: true,
      modulesCount: 5000,
      profile: false,
      dependencies: true,
      dependenciesCount: 10000,
      percentBy: null
    })
  ],
};
