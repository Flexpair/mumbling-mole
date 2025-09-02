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
      // Use vendored fork by default; allow forcing shim via IDENTITY_WIDGET=shim (for tests)
      'netlify-identity-widget': (process.env.IDENTITY_WIDGET === 'shim')
        ? path.resolve(__dirname, 'app/netlify-identity-shim.js')
        : path.resolve(__dirname, 'vendor/netlify-identity-widget/src/netlify-identity.js'),
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
      // Ensure the vendored identity widget can import CSS as a raw string
      // for injection into the iframe (widget expects .toString() on it)
      {
        test: /vendor\/netlify-identity-widget\/src\/components\/modal\.css$/,
        use: [
          { loader: 'raw-loader' },
        ],
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
      // Transpile vendored identity widget source
      {
        test: /vendor\/netlify-identity-widget\/src\/.*\.js$/,
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false,
            cacheDirectory: true,
            presets: [["@babel/preset-env", { loose: true, modules: false, targets: { browsers: ["> 1%", "last 2 versions", "not ie <= 11"] } }]],
            plugins: [
              ["@babel/plugin-proposal-decorators", { legacy: true }],
              ["@babel/plugin-proposal-class-properties", { loose: true }],
              ["@babel/plugin-transform-runtime", { loose: true, regenerator: true }],
              ["@babel/plugin-transform-react-jsx", { pragma: "h" }],
            ],
          },
        },
      },
  // no extra rule needed for the shim
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
  // Note: manifest.json is copied and transformed via CopyWebpackPlugin below,
  // so we don't rely on this loader-chain anymore.
      {
        test: /\.(svg|png|ico)$/,
        use: [{ loader: "file-loader", options: { esModule: false } }],
      },
      { test: /worker\.js$/, use: { loader: "worker-loader" } },
      // Inline fs.readFileSync(...) in third-party libs (mumble-client / mumble-streams)
      { enforce: "post", test: /mumble-(client|streams)\/.*\.js$/, use: ["transform-loader?brfs"] },
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
        // Copy all favicons except the manifest; handle manifest with transform below
        {
          from: path.join(__dirname, "app/favicons"),
          to: path.join(__dirname, "dist/favicons"),
          globOptions: { ignore: ["**/manifest.json"] },
        },
        // Also provide a root-level /favicon.ico for browsers that request it implicitly
        {
          from: path.join(__dirname, "app/favicons/favicon.ico"),
          to: path.join(__dirname, "dist/favicon.ico"),
          noErrorOnMissing: true,
        },
        // Copy and sanitize manifest.json by replacing custom #require('./file') placeholders
        // with plain file names so the JSON stays valid when served statically.
        {
          from: path.join(__dirname, "app/favicons/manifest.json"),
          to: path.join(__dirname, "dist/favicons/manifest.json"),
          transform(content) {
            const input = content.toString();
            // Replace occurrences like: "src": "#require('./favicon192px.png')" -> "src": "favicon192px.png"
            const output = input.replace(/#require\('\.\/(.*?)'\)/g, '$1');
            return Buffer.from(output);
          },
        },
        { from: path.join(theme, "svg"), to: path.join(__dirname, "dist/svg") },
        { from: path.join(theme, "img"), to: path.join(__dirname, "dist/img") },
      ],
    }),
  ],
};
