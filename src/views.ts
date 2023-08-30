import {simple_response, cached_proxy, View} from './utils'
import {PUBLIC_KEY_LENGTH} from './constants'
import {site_request, create_site} from './ephemeral_sites'
import styles from './index/styles/main.scss'
import readme from '../README.md'
import github_svg from './index/github.svg'
import moon_svg from './index/moon.svg'
import index_html from './index/index.html'

export const site_path_regex = new RegExp(`^\\/([a-z0-9]{${PUBLIC_KEY_LENGTH}})(\\/.*)`)

const fonts_root = 'https://raw.githubusercontent.com/rsms/inter/v3.15'
const this_repo_root = 'https://raw.githubusercontent.com/samuelcolvin/smokeshow/master'

export const views: View[] = [
  {
    match: '/',
    view: async ({env}) => {
      const index_html_content = index_html
        .replace('{readme}', readme)
        .replace('{github_svg}', github_svg)
        .replace('{moon_svg}', moon_svg)
        .replace('{github_sha}', env.GITHUB_SHA || 'unknown')
        .replace('{github_ref}', env.GITHUB_REF || 'unknown')
        .replace('{debug}', env.DEBUG)
      return simple_response(index_html_content, 'text/html', 3600)
    },
  },
  {
    match: '/favicon.ico',
    view: async ({env}) => cached_proxy(`${this_repo_root}/icons/favicon.ico`, 'image/vnd.microsoft.icon', env),
  },
  {
    match: '/icon.svg',
    view: async ({env}) => cached_proxy(`${this_repo_root}/icons/icon.svg`, 'image/svg+xml', env),
  },
  {
    match: '/styles.css',
    view: async () => simple_response(styles, 'text/css', 3600),
  },
  {
    match: /^\/fonts\/Inter-(Regular|Medium|Bold).(woff|woff2)$/,
    view: ({env}, info) => {
      const [, weight, ext] = info.match as RegExpMatchArray
      return cached_proxy(`${fonts_root}/docs/font-files/Inter-${weight}.${ext}`, `font/${ext}`, env)
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
