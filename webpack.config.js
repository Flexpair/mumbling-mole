const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
// Added Node polyfills + ProvidePlugin/DefinePlugin to fix runtime 'process is not defined'
// after upgrading dependencies; keeps vendored mumble-client utils working.

var path = require("path");

const resolvedMode = (process.env.WEBPACK_MODE || process.env.NODE_ENV || 'production').toLowerCase();
const mode = resolvedMode === 'development' ? 'development' : 'production';
const isDev = mode === 'development';

const optimization = {
  minimize: !isDev,
};

if (isDev) {
  Object.assign(optimization, {
    moduleIds: 'named',
    chunkIds: 'named',
    usedExports: false,
    sideEffects: false,
    concatenateModules: false,
    mangleExports: false,
    removeAvailableModules: false,
    removeEmptyChunks: false,
  });
} else {
  Object.assign(optimization, {
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
  });
}

const config = {
  mode,
  entry: {
    index: ["./app/index.js"], // HTML now handled by HtmlWebpackPlugin template
    config: "./app/config.js",
    theme: "./app/theme.js",
  },
  devtool: isDev ? 'eval-source-map' : false,
  stats: {
    preset: 'minimal',
    assets: true,
    chunks: false,
    modules: isDev,
    timings: true,
    builtAt: true
  },
  output: {
    path: path.join(__dirname, "dist"),
    chunkFilename: isDev ? "[name].js" : "[chunkhash].js",
    filename: "[name].js",
    publicPath: "",
    devtoolModuleFilenameTemplate: isDev
      ? info => `webpack:///${path.relative(__dirname, info.absoluteResourcePath)}`
      : undefined,
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
  optimization,
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
      minify: isDev ? false : { removeComments: false },
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
  performance: isDev ? { hints: false } : undefined,
};

module.exports = config;
