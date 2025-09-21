const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const webpack = require('webpack');
// Added Node polyfills + ProvidePlugin/DefinePlugin to fix runtime 'process is not defined'
// after upgrading dependencies; keeps vendored mumble-client utils working.

var theme = "../themes/MetroMumbleLight";
var path = require("path");

module.exports = {
  mode: "production",
  entry: {
    index: ["./app/index.js", "./app/index.html"],
    config: "./app/config.js",
    theme: "./app/theme.js",
  },
  devtool: false,
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
      {
        test: /\.html$/,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "[name].[ext]",
              esModule: false,
            },
          },
          {
            loader: "extract-loader",
          },
          {
            loader: "html-loader",
            options: {
              esModule: false,
              // IMPORTANT: Keep Knockout virtual element comments (<!-- ko ... -->) intact.
              // We still want general minification, just not comment stripping.
              // html-loader passes this object to html-minifier-terser.
              // Setting removeComments:false preserves KO containerless bindings while
              // allowing whitespace/attribute/collapsing optimizations.
              minimize: {
                removeComments: false,
              },
              sources: {
                list: [
                  {
                    tag: "img",
                    attribute: "src",
                    type: "src",
                  },
                  {
                    tag: "link",
                    attribute: "href",
                    type: "src",
                  },
                ]
              },
              preprocessor: (content, loaderContext) => {
                // Transform absolute paths to theme-relative paths
                let result = content;
                result = result.replace(/src="\/svg\//g, `src="${theme}/svg/`);
                result = result.replace(/src="\/img\//g, `src="${theme}/img/`);
                result = result.replace(/href="\/svg\//g, `href="${theme}/svg/`);
                result = result.replace(/href="\/img\//g, `href="${theme}/img/`);
                return result;
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
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
            loader: "css-loader",
            options: {
              esModule: false,
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "[hash].css",
              esModule: false,
            },
          },
          {
            loader: "extract-loader",
          },
          {
            loader: "css-loader",
            options: {
              esModule: false,
            },
          },
          {
            loader: "sass-loader",
          },
        ],
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
        test: /worker\.js$/,
        use: { loader: "worker-loader" },
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
  },
  resolve: {
    // Explicit fallbacks ensure consistent behavior regardless of node-polyfill-webpack-plugin
    // internal alias changes across major versions.
    fallback: {
      buffer: require.resolve('buffer/'),
      stream: require.resolve('stream-browserify'),
      util: require.resolve('util/'),
      process: require.resolve('process/browser'),
    }
  },
  plugins: [
    new NodePolyfillPlugin(), // Base polyfills (minus globals we explicitly control)
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: ['process/browser']
    }),
    new webpack.DefinePlugin({
      'process.browser': 'true'
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
