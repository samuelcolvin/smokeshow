import {simple_response, cached_proxy, json_response, View, list_all} from './utils'
import {PUBLIC_KEY_LENGTH, TESTING} from './constants'
import {site_request, create_site} from './ephemeral_sites'
import styles from './index/styles/main.scss'
import readme from '../README.md'
import github_svg from '!raw-loader!./index/github.svg'
import moon_svg from '!raw-loader!./index/moon.svg'
import index_html from '!raw-loader!./index/index.html'

export const site_path_regex = new RegExp(`^\\/([a-z0-9]{${PUBLIC_KEY_LENGTH}})(\\/.*)`)

declare const STORAGE: KVNamespace

const index_html_final = index_html
  .replace('{readme}', readme)
  .replace('{github_svg}', github_svg)
  .replace('{moon_svg}', moon_svg)

const fonts_root = 'https://raw.githubusercontent.com/rsms/inter/v3.15'
const this_repo_root = 'https://raw.githubusercontent.com/samuelcolvin/smokeshow/master'

export const views: View[] = [
  {
    match: '/',
    view: async () => simple_response(index_html_final, 'text/html', 3600),
  },
  {
    match: '/favicon.ico',
    view: async () => cached_proxy(`${this_repo_root}/icons/favicon.ico`, 'image/vnd.microsoft.icon'),
  },
  {
    match: '/icon.svg',
    view: async () => cached_proxy(`${this_repo_root}/icons/icon.svg`, 'image/svg+xml'),
  },
  {
    match: '/styles.css',
    view: async () => simple_response(styles, 'text/css', 3600),
  },
  {
    match: /^\/fonts\/Inter-(Regular|Medium|Bold).(woff|woff2)$/,
    view: (request, info) => {
      const [, weight, ext] = info.match as RegExpMatchArray
      return cached_proxy(`${fonts_root}/docs/font-files/Inter-${weight}.${ext}`, `font/${ext}`)
    },
  },
  {
    match: '/create/',
    allow: 'POST',
    view: create_site,
  },
  {
    match: site_path_regex,
    allow: ['GET', 'POST'],
    view: site_request,
  },
]

if (TESTING) {
  /**
   * These views are specifically for testing with pytest-cloudflare-worker, they will only be available during tests
   */
  views.push({
    match: '/testing/storage/',
    allow: ['GET', 'DELETE'],
    view: async (request: Request) => {
      if (request.method == 'DELETE') {
        const keys = (await list_all('')).map(k => k.name)
        await Promise.all(keys.map(k => STORAGE.delete(k)))
        return json_response({keys_deleted: keys.length})
      } else {
        return json_response(await list_all(''))
      }
    },
  })
}
