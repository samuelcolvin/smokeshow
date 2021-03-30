import {HttpError} from './utils'
import {AUTH_HASH_THRESHOLD, UPLOAD_TTL} from './constants'

declare const STORAGE: KVNamespace

export async function check_create_auth(request: Request): Promise<string> {
  const auth_key = get_auth_header(request)
  const auth_array = get_auth_array(auth_key)

  const hash = await crypto.subtle.digest('sha-256', auth_array)
  const hash_int = new Uint8Array(hash).reduce((a, v) => a * 256 + v, 0)

  if (hash_int > AUTH_HASH_THRESHOLD) {
    throw new HttpError(403, 'Invalid Authorisation header, you need to generate a key with a valid hash')
  }
  return auth_key
}

export interface UploadAuth {
  public_key: string
  creation: number
}

export async function check_upload_auth(public_key: string, request: Request): Promise<number> {
  const auth_key = get_auth_header(request)
  const auth_array = get_auth_array(auth_key)

  const upload_auth = await decode_signed_object(auth_array)

  if (upload_auth.public_key != public_key) {
    throw new HttpError(400, "Authorisation secret doesn't match public key from upload URL")
  } else if (upload_auth.creation + UPLOAD_TTL < Date.now()) {
    throw new HttpError(410, 'Too late, uploads are no longer allowed for this site')
  }

  return upload_auth.creation
}

export async function sign_auth(upload_auth: UploadAuth): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify([upload_auth.public_key, upload_auth.creation]))

  const secret_key = await get_hmac_secret_key()
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', secret_key, data))

  // length has to be hard coded as it's used in
  if (signature.length != 64) {
    console.error('signature:', signature)
    throw Error(`raw HMAC signature should have length 64, not ${signature.length}`)
  }
  const signed = new Uint8Array(64 + data.length)
  signed.set(signature)
  signed.set(data, 64)
  return array_to_base64(signed)
}

export function create_random_string(length: number): string {
  const raw = new Uint8Array(Math.ceil(length / 2))
  crypto.getRandomValues(raw)
  return Array.from(raw)
    .map(v => ('0' + v.toString(36)).slice(-2))
    .join('')
    .substr(0, length)
}

function get_auth_header(request: Request): string {
  const authorisation = request.headers.get('authorisation')
  if (!authorisation) {
    throw new HttpError(401, 'Authorisation header required', {'www-authenticate': 'Basic'})
  }
  // replace gets rid of optional "Bearer " prefix
  return authorisation.replace(/^bearer /i, '')
}

function get_auth_array(auth_b64: string): Uint8Array {
  try {
    return Uint8Array.from(atob(auth_b64), c => c.charCodeAt(0))
  } catch (err) {
    throw new HttpError(403, 'Invalid Authorisation header, not correctly Base64 encoded')
  }
}

const hmac_algo: HmacImportParams = {name: 'HMAC', hash: {name: 'SHA-512'}}
const hmac_key_usage: KeyUsage[] = ['sign', 'verify']

async function get_hmac_secret_key(): Promise<CryptoKey> {
  const raw_key = await STORAGE.get('hmac_secret_key', 'arrayBuffer')
  if (raw_key) {
    return await crypto.subtle.importKey('raw', raw_key, hmac_algo, true, hmac_key_usage)
  } else {
    const secret_key = (await crypto.subtle.generateKey(hmac_algo, true, hmac_key_usage)) as CryptoKey

    const new_raw_key = await crypto.subtle.exportKey('raw', secret_key)
    await STORAGE.put('hmac_secret_key', new_raw_key)
    return secret_key
  }
}
async function decode_signed_object(raw_signed: Uint8Array): Promise<UploadAuth> {
  const signature = raw_signed.subarray(0, 64)
  const data = raw_signed.subarray(64)

  const secret_key = await get_hmac_secret_key()
  const valid = await crypto.subtle.verify('HMAC', secret_key, signature, data)
  if (!valid) {
    throw new HttpError(
      403,
      'Invalid Authorisation header, you need to use the "secret_key" returned when creating the site',
    )
  }
  const obj = new TextDecoder().decode(data)
  const [public_key, creation] = JSON.parse(obj)
  return {public_key, creation}
}

export const array_to_base64 = (array: Uint8Array): string => btoa(String.fromCharCode.apply(null, array as any))
