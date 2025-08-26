const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const path = require("path");
// Resolve theme assets relative to this config file to avoid environment-dependent cwd issues
const theme = path.join(__dirname, "themes/MetroMumbleLight");

module.exports = {
  mode: "production",
  entry: {
  index: ["./app/index.html", "./app/index.js"],
    config: "./app/config.js",
    theme: "./app/theme.js",
  },
  devtool: false,
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
            babelrc: true,
            cacheDirectory: true,
            presets: [
              [
                "@babel/preset-env",
                {
                  loose: true,
                  modules: false,
                  targets: {
                    browsers: ["> 1%", "last 2 versions", "not ie <= 11"]
                  }
                }
              ]
            ],
            plugins: [
              [
                "@babel/plugin-transform-runtime",
                {
                  loose: true,
                  regenerator: true
                }
              ],
              [
                "@babel/plugin-transform-class-properties",
                {
                  loose: true
                }
              ],
              [
                "@babel/plugin-transform-private-methods",
                {
                  loose: true
                }
              ],
              [
                "@babel/plugin-transform-private-property-in-object",
                {
                  loose: true
                }
              ]
            ]
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
              attrs: ["img:src", "link:href"],
              root: theme,
              minimize: false
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
          "raw-loader",
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
  plugins: [new NodePolyfillPlugin()],
};
