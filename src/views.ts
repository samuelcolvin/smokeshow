import {html_response, HttpError, json_response, View} from './utils'
import {check_create_auth, create_random_string, check_upload_auth, sign_auth} from './auth'
import {INFO_FILE_NAME, PUBLIC_KEY_LENGTH, SITE_TTL, UPLOAD_TTL} from './constants'

declare const HIGH_TMP: KVNamespace

interface SiteSummary {
  files?: string[]
}

async function site_summary(public_key: string): Promise<SiteSummary> {
  const raw = await HIGH_TMP.get(`site:${public_key}:${INFO_FILE_NAME}`, 'json')
  const obj = raw as Record<string, any>
  const files = await HIGH_TMP.list({prefix: `site:${public_key}:`})
  obj.files = files.keys.map(k => k.name.substr(PUBLIC_KEY_LENGTH + 6)).filter(f => f != INFO_FILE_NAME)
  return obj
}

function* get_index_options(public_key: string, path: string) {
  yield `site:${public_key}:${path}index.html`
  yield `site:${public_key}:${path.slice(0, -1)}.html`
  yield `site:${public_key}:${path}index.json`
}

async function get_file(request: Request, public_key: string, path: string): Promise<Response> {
  if (path === INFO_FILE_NAME) {
    return json_response(await site_summary(public_key))
  }

  let v = await HIGH_TMP.getWithMetadata(`site:${public_key}:${path}`, 'stream')

  if (!v.value && path.endsWith('/')) {
    const index_options = get_index_options(public_key, path)
    let next
    while (!v.value && !(next = index_options.next()).done) {
      v = await HIGH_TMP.getWithMetadata(next.value as string, 'stream')
    }

    if (!v.value && path == '/') {
      return json_response({
        message: `The site (${public_key} has no index file, hence this summary response`,
        summary: await site_summary(public_key),
      })
    }
  }
  let status = 200

  if (!v.value) {
    // check if we have a 404.html or 404.txt file, if so use that and change the status, else throw a generic 404
    v = await HIGH_TMP.getWithMetadata(`site:${public_key}:/404.html`, 'stream')
    if (!v.value) {
      v = await HIGH_TMP.getWithMetadata(`site:${public_key}:/404.txt`, 'stream')
    }
    if (!v.value) {
      throw new HttpError(404, `File "${path}" not found in site "${public_key}"`)
    } else {
      status = 404
    }
  }

  const headers: Record<string, string> = {}
  const metadata: {content_type?: string} = (v.metadata as any) || {}
  headers['content-type'] = metadata.content_type || 'application/octet-stream'
  return new Response(v.value, {status, headers})
}

async function post_file(request: Request, public_key: string, path: string): Promise<Response> {
  const creation_ms = await check_upload_auth(public_key, request)
  if (path == INFO_FILE_NAME) {
    throw new HttpError(403, `Overwriting "${INFO_FILE_NAME}" is forbidden`)
  }

  const content_type = request.headers.get('content-type')
  const blob = await request.blob()
  await HIGH_TMP.put(`site:${public_key}:${path}`, blob.stream(), {
    expiration: Math.round((creation_ms + SITE_TTL) / 1000),
    metadata: {content_type},
  })

  return json_response({path, content_type})
}

const site_path_regex = new RegExp(`^\\/([a-z0-9]{${PUBLIC_KEY_LENGTH}})(\\/.*)`)

export const views: View[] = [
  {
    match: '/',
    allow: 'GET',
    view: async () =>
      html_response(`
<h1>Index</h1>

<p>This is the index page, it doesn't say much interesting yet</p>
`),
  },
  {
    match: '/create/',
    allow: 'POST',
    view: async (request, info) => {
      await check_create_auth(request)
      const public_key = create_random_string(PUBLIC_KEY_LENGTH)

      if (await HIGH_TMP.get(`site:${public_key}:${INFO_FILE_NAME}`)) {
        // shouldn't happen
        throw new HttpError(409, 'Site with this public key already exists')
      }
      const creation = new Date()
      const creation_ms = creation.getTime()
      const secret_key = await sign_auth({public_key, creation: creation_ms})

      const site_expiration_date = new Date(creation_ms + SITE_TTL)
      const upload_expiration_date = new Date(creation_ms + UPLOAD_TTL)

      const site_info = {
        public_key,
        url: `${info.url.origin}/${public_key}/`,
        site_creation: creation.toISOString(),
        site_expiration: site_expiration_date.toISOString(),
      }
      await HIGH_TMP.put(`site:${public_key}:${INFO_FILE_NAME}`, JSON.stringify(site_info, null, 2), {
        expiration: Math.round(site_expiration_date.getTime() / 1000),
      })

      return json_response({
        message: 'New site created successfully',
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

export function smart_referrer_redirect(request: Request, url: URL): string | undefined {
  // magic to redirect requests where a site had a link to a resource assuming it was deploy on route
  // eg. a request to /favicon.ico with a referrer .../<site pk>/... will be redirected to .../<site pk>/favicon.ico

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
    // referrer is not hightmp
    return
  }
  const match = referrer_url.pathname.match(site_path_regex)
  if (match) {
    return `${url.origin}/${match[1]}${url.pathname}`
  }
}
