import fs from 'node:fs'
import path from 'node:path'
import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'
import { marked } from 'marked'
import hljs from 'highlight.js'

marked.use({
  gfm: true,
  highlight: function(code, language) {
    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext'
    return hljs.highlight(validLanguage, code).value
  }
})

let markdownPlugin = {
  name: 'markdown',
  setup(build) {
    build.onResolve({ filter: /\.md$/ }, args => ({
      path: path.join(args.resolveDir, args.path),
      namespace: 'markdown',
    }))

    build.onLoad({ filter: /.*/, namespace: 'markdown' }, async (args) => {
      const md = await fs.promises.readFile(args.path, 'utf8')
      return {
        contents: marked(md),
        loader: 'text',
      }
    })
  },
}

let ignoreFontsPlugin = {
  name: 'ignore-fonts',
  setup(build) {
    // ignore font files imported in scss
    build.onResolve({ filter: /\.woff2?$/ }, args => {
      return { path: args.path, external: true }
    })
  },
}

await esbuild.build({
  format: 'esm',
  mainFields: ['browser', 'module', 'main'],
  platform: 'neutral',
  target: 'es2020',
  sourcemap: false,
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'worker/index.mjs',
  loader: {
    '.html': 'text',
    '.svg': 'text',
    '.woff': 'empty',
    '.woff2': 'empty',
  },
  plugins: [
    markdownPlugin,
    ignoreFontsPlugin,
    sassPlugin({type: 'css-text'}),
  ],
})
