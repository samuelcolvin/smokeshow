import {HttpError} from './utils'

const auth_threshold = 2 ** 233

export async function check_auth(request: Request): Promise<void> {
  const authorisation = request.headers.get('authorisation')
  if (!authorisation) {
    throw new HttpError(401, 'Authorisation header required', {'www-authenticate': 'Basic'})
  }

  const array_key = Uint8Array.from(atob(authorisation), c => c.charCodeAt(0))
  const hash = await crypto.subtle.digest('sha-256', array_key)
  const hash_int = new Uint8Array(hash).reduce((a, v) => a * 256 + v, 0)

  if (hash_int > auth_threshold) {
    throw new HttpError(403, 'Invalid Authorisation header')
  }
}

export function create_random_hex(length: number): string {
  const raw = new Uint8Array(Math.ceil(length / 2))
  crypto.getRandomValues(raw)
  return Array.from(raw)
    .map(v => ('0' + v.toString(16)).slice(-2))
    .join('')
    .substr(0, length)
}
