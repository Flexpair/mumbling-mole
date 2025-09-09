const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

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
  plugins: [
    new NodePolyfillPlugin(),
    new (require('webpack')).ProgressPlugin({
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
