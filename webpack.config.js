const path = require('path')
const hljs = require('highlight.js')
const {WranglerJsCompatWebpackPlugin} = require("wranglerjs-compat-webpack-plugin")

module.exports = {
  output: {
    filename: 'worker.js',
    path: path.join(__dirname, 'dist'),
  },
  devtool: 'cheap-module-source-map',
  mode: 'development',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.css', '.scss'],
  },
  plugins: [new WranglerJsCompatWebpackPlugin()],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          // transpileOnly: true,
        }
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          'raw-loader',
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                outputStyle: 'expanded',
              },
            },
          }
        ],
      },
      {
        test: /\.md$/i,
        use: [
          'raw-loader',
          {
            loader: 'markdown-loader',
            options: {
              highlight: function(code, language) {
                const validLanguage = hljs.getLanguage(language) ? language : 'plaintext'
                return hljs.highlight(validLanguage, code).value
              }
            }
          }
        ]
      }
    ],
  },
}
