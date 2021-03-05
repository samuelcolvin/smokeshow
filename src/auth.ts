import {HttpError} from './utils'
import {INFO_FILE_NAME, AUTH_HASH_THRESHOLD} from './constants'

declare const HIGH_TMP: KVNamespace

export async function check_create_auth(request: Request): Promise<void> {
  let authorisation = request.headers.get('authorisation')
  if (!authorisation) {
    throw new HttpError(401, 'Authorisation header required', {'www-authenticate': 'Basic'})
  }
  authorisation = authorisation.replace(/^bearer /i, '')
  const array_key = Uint8Array.from(atob(authorisation), c => c.charCodeAt(0))
  const hash = await crypto.subtle.digest('sha-256', array_key)
  const hash_int = new Uint8Array(hash).reduce((a, v) => a * 256 + v, 0)

  if (hash_int > AUTH_HASH_THRESHOLD) {
    throw new HttpError(403, 'Invalid Authorisation header, you need to generate a key with a valid hash')
  }
}

export interface UploadInfo {
  site_expiration: number,
  secret_key: string,
}

export async function check_upload_auth(public_key: string, request: Request): Promise<number> {
  let authorisation = request.headers.get('authorisation')
  if (!authorisation) {
    throw new HttpError(401, 'Authorisation header required', {'www-authenticate': 'Basic'})
  }
  authorisation = authorisation.replace(/^bearer /i, '')

  const upload_info: UploadInfo | null = await HIGH_TMP.get(`site:${public_key}|upload`, 'json')
  if (!upload_info) {
    if (await HIGH_TMP.get(`site:${public_key}:${INFO_FILE_NAME}`)) {
      // site exists, but upload is not longer allowed
      throw new HttpError(410, 'Too late, site exists but upload is no longer allowed')
    } else {
      throw new HttpError(404, 'Site not found')
    }
  }

  if (authorisation != upload_info.secret_key) {
    throw new HttpError(
      403,
      'Invalid Authorisation header, you need to use the "secret_key" returned when creating the site',
    )
  }
  return upload_info.site_expiration
}

export function create_random_hex(length: number): string {
  const raw = new Uint8Array(Math.ceil(length / 2))
  crypto.getRandomValues(raw)
  return Array.from(raw)
    .map(v => ('0' + v.toString(16)).slice(-2))
    .join('')
    .substr(0, length)
}
