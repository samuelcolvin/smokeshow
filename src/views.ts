import {
  clean_path,
  simple_response,
  cached_proxy,
  response_from_cache,
  HttpError,
  json_response,
  View,
  site_summary,
  list_all,
} from './utils'
import {check_create_auth, create_random_string, check_upload_auth, sign_auth} from './auth'
import {INFO_FILE_NAME, PUBLIC_KEY_LENGTH, SITE_TTL, UPLOAD_TTL, TESTING} from './constants'
import {create_site_check, new_file_check} from './limits'
import styles from './index/styles/main.scss'
import readme from '../README.md'
import github_svg from '!raw-loader!./index/github.svg'
import moon_svg from '!raw-loader!./index/moon.svg'
import index_html from '!raw-loader!./index/index.html'

declare const STORAGE: KVNamespace

const index_html_final = index_html
  .replace('{readme}', readme)
  .replace('{github_svg}', github_svg)
  .replace('{moon_svg}', moon_svg)

function* get_index_options(public_key: string, path: string) {
  yield `site:${public_key}:${path}index.html`
  yield `site:${public_key}:${path.slice(0, -1)}.html`
  yield `site:${public_key}:${path}index.json`
}

async function get_file(request: Request, public_key: string, path: string): Promise<Response> {
  if (path === INFO_FILE_NAME) {
    return json_response(await site_summary(public_key))
  }

  let v = await STORAGE.getWithMetadata(`site:${public_key}:${path}`, 'stream')

  if (!v.value && path.endsWith('/')) {
    const index_options = get_index_options(public_key, path)
    let next
    while (!v.value && !(next = index_options.next()).done) {
      v = await STORAGE.getWithMetadata(next.value as string, 'stream')
    }

    if (!v.value && path == '/') {
      return json_response({
        message: `The site "${public_key}" has no index file, hence this summary response`,
        summary: await site_summary(public_key),
      })
    }
  }
  let status = 200

  if (!v.value) {
    // check if we have a 404.html or 404.txt file, if so use that and change the status, else throw a generic 404
    v = await STORAGE.getWithMetadata(`site:${public_key}:/404.html`, 'stream')
    if (!v.value) {
      v = await STORAGE.getWithMetadata(`site:${public_key}:/404.txt`, 'stream')
    }
    if (!v.value) {
      throw new HttpError(404, `File "${path}" not found in site "${public_key}"`)
    } else {
      status = 404
    }
  }

  return response_from_cache(v, status)
}

async function post_file(request: Request, public_key: string, path: string): Promise<Response> {
  const creation_ms = await check_upload_auth(public_key, request)
  if (path == INFO_FILE_NAME) {
    throw new HttpError(403, `Overwriting "${INFO_FILE_NAME}" is forbidden`)
  }

  const content_type = request.headers.get('content-type')
  const blob = await request.blob()
  const size = blob.size

  const total_site_size = await new_file_check(public_key, size)

  await STORAGE.put(`site:${public_key}:${path}`, blob.stream(), {
    expiration: Math.round((creation_ms + SITE_TTL) / 1000),
    metadata: {content_type, size},
  })

  return json_response({path, content_type, size, total_site_size})
}

const site_path_regex = new RegExp(`^\\/([a-z0-9]{${PUBLIC_KEY_LENGTH}})(\\/.*)`)
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
    view: async (request, info) => {
      const auth_key = await check_create_auth(request)
      const public_key = create_random_string(PUBLIC_KEY_LENGTH)

      const user_agent = request.headers.get('user-agent')
      if (!user_agent) {
        throw new HttpError(400, 'No "User-Agent" header found')
      }
      const ip_address = request.headers.get('cf-connecting-ip') as string

      if (await STORAGE.get(`site:${public_key}:${INFO_FILE_NAME}`)) {
        // shouldn't happen
        throw new HttpError(409, 'Site with this public key already exists')
      }
      const sites_created_24h = await create_site_check(public_key, auth_key, user_agent, ip_address)
      console.log(
        `creating new site public_key=${public_key} sites_created_24h=${sites_created_24h} auth_key=${auth_key}`,
      )

      const creation = new Date()
      const creation_ms = creation.getTime()

      const secret_key = await sign_auth({public_key, creation: creation_ms})

      const site_expiration_date = new Date(creation_ms + SITE_TTL)
      const upload_expiration_date = new Date(creation_ms + UPLOAD_TTL)

      const site_info = {
        url: `${info.url.origin}/${public_key}/`,
        site_creation: creation.toISOString(),
        site_expiration: site_expiration_date.toISOString(),
      }
      const info_json = JSON.stringify(site_info, null, 2)
      await STORAGE.put(`site:${public_key}:${INFO_FILE_NAME}`, info_json, {
        expiration: Math.round(site_expiration_date.getTime() / 1000),
        metadata: {content_type: 'application/json', size: info_json.length},
      })

      return json_response({
        message: 'New site created successfully',
        sites_created_24h,
        secret_key,
        upload_expiration: upload_expiration_date.toISOString(),
        ...site_info,
      })
    },
  },
  {
    match: site_path_regex,
    allow: ['GET', 'POST'],
    view: async (request, info) => {
      const [, public_key, path] = info.match as RegExpMatchArray
      if (request.method == 'GET') {
        return await get_file(request, public_key, path)
      } else {
        // method == 'POST'
        return await post_file(request, public_key, path)
      }
    },
  },
]

if (TESTING) {
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

export function smart_referrer_redirect(request: Request, url: URL): string | undefined {
  // magic to redirect requests where a site had a link to a resource assuming it was deploy on route
  // eg. a request to /favicon.ico with a referrer .../<site pk>/... will be redirected to .../<site pk>/favicon.ico

  if (request.method != 'GET') {
    return
  }

  if (url.pathname.match(site_path_regex)) {
    // request is already to a site
    return
  }
  const referrer = request.headers.get('referer')
  if (!referrer) {
    // no referer header
    return
  }
  const referrer_url = new URL(referrer)
  if (referrer_url.origin != url.origin) {
    // referrer is not smokeshow
    return
  }
  const match = clean_path(referrer_url).match(site_path_regex)
  if (match) {
    return `${url.origin}/${match[1]}${url.pathname}`
  }
}
