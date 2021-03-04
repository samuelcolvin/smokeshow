import {html_response, json_response, View} from './utils'
import {check_auth, create_random_hex} from './auth'

declare const HIGH_TMP: KVNamespace

export const views: View[] = [
  {
    match: '/',
    method: 'GET',
    view: async () =>
      html_response(`
<h1>Index</h1>

<p>This is the index page, it doesn't say much interesting yet</p>
`),
  },
  {
    match: '/create/',
    method: 'POST',
    view: async (request, url) => {
      await check_auth(request)
      const public_key = create_random_hex(24)
      const secret_key = 'sk_' + create_random_hex(60)
      const now = Date.now()
      const space_expires = new Date(now + 30 * 7 * 3600 * 1000)
      const upload_expires = new Date(now + 3600 * 1000)
      await HIGH_TMP.put(`space:${public_key}`, secret_key, {
        expiration: space_expires.getTime() / 1000,
        metadata: {upload_expires: upload_expires.getTime()},
      })

      return json_response({
        message: 'New site created successfully',
        public_key,
        secret_key,
        url: `https://${url.hostname}/${public_key}/`,
        space_expires: {
          unix: space_expires.getTime(),
          human: space_expires.toDateString(),
        },
        upload_expires: {
          unix: upload_expires.getTime(),
          human: upload_expires.toDateString(),
        },
      })
    },
  },
]
