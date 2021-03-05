import {html_response, HttpError, json_response, View} from './utils'
import {check_create_auth, create_random_hex, check_upload_auth, UploadInfo} from './auth'

declare const HIGH_TMP: KVNamespace


async function site_summary(public_key: string): Promise<Response> {
  const raw = await HIGH_TMP.get(`site:${public_key}:/site.json`, 'json')
  const obj = raw as Record<string, any>
  const files = await HIGH_TMP.list({prefix: `site:${public_key}:`})
  obj.files = files.keys.map(k => k.name.substr(30)).filter(f => f != '/site.json')
  return json_response(obj)
}

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
      const public_key = create_random_hex(24)
      const secret_key = 'sk_' + create_random_hex(60)

      if (await HIGH_TMP.get(`site:${public_key}:site.json`)) {
        // shouldn't happen
        throw new HttpError(409, 'Site with this public key already exists')
      }

      const creation = new Date()
      const site_expiration_date = new Date(creation.getTime() + 30 * 24 * 3600 * 1000)
      const upload_expiration_date = new Date(creation.getTime() + 3600 * 1000)
      const site_expiration = Math.round(site_expiration_date.getTime() / 1000)

      const upload_info: UploadInfo = {site_expiration, secret_key}
      await HIGH_TMP.put(`site:${public_key}|upload`, JSON.stringify(upload_info), {
        expiration: upload_expiration_date.getTime() / 1000,
      })
      const site_info = {
        public_key,
        url: `https://${info.url.hostname}/${public_key}/`,
        site_creation: creation.toISOString(),
        site_expiration: site_expiration_date.toISOString(),
        upload_expiration: upload_expiration_date.toISOString(),
      }
      await HIGH_TMP.put(`site:${public_key}:/site.json`, JSON.stringify(site_info, null, 2), {
        expiration: site_expiration,
      })

      return json_response({
        message: 'New site created successfully',
        secret_key,
        ...site_info
      })
    },
  },
  {
    match: /^\/([a-f0-9]{24})(\/.*)/,
    allow: 'POST',
    skip_405: true,
    view: async (request, info) => {
      const [, public_key, path] = info.match as RegExpMatchArray
      const site_expiration = await check_upload_auth(public_key, request)
      if (path == '/site.json') {
        throw new HttpError(403, 'Overwriting "/site.json" is forbidden')
      }

      const content_type = request.headers.get('content-type')
      const blob = await request.blob()
      await HIGH_TMP.put(`site:${public_key}:${path}`, blob.stream(), {
        expiration: site_expiration,
        metadata: {content_type}
      })

      return json_response({path, content_type})
    },
  },
  {
    match: /^\/([a-f0-9]{24})(\/.*)/,
    allow: 'GET',
    view: async (request, info) => {
      const [, public_key, path] = info.match as RegExpMatchArray

      if (path === '/site.json') {
        return await site_summary(public_key)
      }

      let v = await HIGH_TMP.getWithMetadata(`site:${public_key}:${path}`, 'stream')

      if (!v.value && path.endsWith('/')) {
        v = await HIGH_TMP.getWithMetadata(`site:${public_key}:${path.slice(0, -1)}.html`, 'stream')
        if (!v.value) {
          v = await HIGH_TMP.getWithMetadata(`site:${public_key}:${path}index.html`, 'stream')
        }
        if (!v.value && path == '/') {
          return await site_summary(public_key)
        }
      }

      if (!v.value) {
        throw new HttpError(404, `File "${path}" not found in site "${public_key}"`)
      }

      const headers: Record<string, string> = {}
      const metadata: {content_type: string | null} = v.metadata as any
      if (metadata.content_type) {
        headers['content-type'] = metadata.content_type
      }
      return new Response(v.value, {headers})
    },
  },
]
