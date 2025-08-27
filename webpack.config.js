const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");
const path = require("path");

// Resolve theme assets relative to this config file to avoid environment-dependent cwd issues
const theme = path.join(__dirname, "themes/MetroMumbleLight");

// No custom diagnostics in production build

module.exports = {
  mode: "production",
  entry: {
    index: "./app/index.js",
    config: "./app/config.js",
    theme: "./app/theme.js",
  },
  devtool: false,
  output: {
    path: path.join(__dirname, "dist"),
    chunkFilename: "[chunkhash].js",
    filename: "[name].js",
    publicPath: "",
  clean: true,
  },
  resolve: {
    alias: {
      // Prefer vendored fork source; fallback to npm/git src; last resort: shim
      'netlify-identity-widget':
        require('fs').existsSync(path.resolve(__dirname, 'vendor/netlify-identity-widget/src/netlify-identity.js'))
          ? path.resolve(__dirname, 'vendor/netlify-identity-widget/src/netlify-identity.js')
          : (require('fs').existsSync(path.resolve(__dirname, 'node_modules/netlify-identity-widget/src/netlify-identity.js'))
              ? path.resolve(__dirname, 'node_modules/netlify-identity-widget/src/netlify-identity.js')
              : path.resolve(__dirname, 'app/netlify-identity-shim.js')),
    },
    fallback: {
      fs: false,
      net: false,
      tls: false,
      dgram: false,
    },
  },
  module: {
    rules: [
      // Special-case the widget's modal CSS: import as string for iframe injection
      {
        test: /vendor\/netlify-identity-widget\/src\/components\/modal\.css$/,
        use: [{ loader: 'raw-loader' }],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            babelrc: true,
            cacheDirectory: true,
            presets: [["@babel/preset-env", { loose: true, modules: false, targets: { browsers: ["> 1%", "last 2 versions", "not ie <= 11"] } }]],
            plugins: [["@babel/plugin-transform-runtime", { loose: true, regenerator: true }]],
          },
        },
      },
      // Transpile the widget source (vendored or node_modules src)
      {
        test: /(vendor|node_modules)\/netlify-identity-widget\/src\/.*\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: true,
            cacheDirectory: true,
            plugins: [
              ['@babel/plugin-proposal-decorators', { legacy: true }],
              // Ensure class fields are transpiled for safe minification (Terser)
              ['@babel/plugin-transform-class-properties', { loose: true }],
              ['@babel/plugin-transform-react-jsx', { pragma: 'h', pragmaFrag: 'Fragment', runtime: 'classic' }],
            ],
          },
        },
      },
      // no extra rule needed for the shim
      // HTML is generated via HtmlWebpackPlugin
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, { loader: "css-loader" }],
      },
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, { loader: "css-loader" }, { loader: "sass-loader" }],
      },
      {
        type: "javascript/auto",
        test: /manifest\.json$|\.xml$/,
        use: [
          { loader: "file-loader", options: { esModule: false } },
          { loader: "extract-loader" },
          {
            loader: "regexp-replace-loader",
            options: {
              match: { pattern: "#require\\('([^']*)'\\)", flags: "g" },
              replaceWith: '"+require("$1")+"',
            },
          },
          "raw-loader",
        ],
      },
      {
        test: /\.(svg|png|ico)$/,
        use: [{ loader: "file-loader", options: { esModule: false } }],
      },
      { test: /worker\.js$/, use: { loader: "worker-loader" } },
      // Temporarily disabled: transform-loader with brfs can hang under webpack 5
      // { enforce: "post", test: /mumble-streams\/lib\/data.js/, use: ["transform-loader?brfs"] },
    ],
  },
  target: "web",
  optimization: { minimize: false },
  plugins: [
    new NodePolyfillPlugin(),
    new MiniCssExtractPlugin({ filename: "[name].css" }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "app/index.html"),
      filename: "index.html",
      inject: false, // template already includes <script src="...">
      minify: false,
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.join(__dirname, "app/favicons"), to: path.join(__dirname, "dist/favicons") },
        { from: path.join(theme, "svg"), to: path.join(__dirname, "dist/svg") },
        { from: path.join(theme, "img"), to: path.join(__dirname, "dist/img") },
      ],
    }),
  ],
};
