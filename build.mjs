import fs from 'node:fs'
import path from 'node:path'
import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'
import { Marked } from 'marked'
import {markedHighlight} from 'marked-highlight'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import hljs from 'highlight.js'

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }),
  gfmHeadingId(),
);

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
        contents: marked.parse(md),
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
