import {HttpError} from './utils'
import {INFO_FILE_NAME, AUTH_HASH_THRESHOLD, UPLOAD_TTL} from './constants'

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

export interface UploadAuth {
  public_key: string
  creation: number
}

export async function check_upload_auth(public_key: string, request: Request): Promise<number> {
  const authorisation = request.headers.get('authorisation')
  if (!authorisation) {
    throw new HttpError(401, 'Authorisation header required', {'www-authenticate': 'Basic'})
  }
  // replace gets rid of optional "Bearer " prefix
  const upload_auth = await decode_signed_object(authorisation.replace(/^bearer /i, ''))
  console.log('upload_auth:', upload_auth)

  if (upload_auth.public_key != public_key) {
    throw new HttpError(400, "Authorisation secret doesn't match public key from upload URL")
  } else if (upload_auth.creation + UPLOAD_TTL < Date.now()) {
    throw new HttpError(410, 'Too late, uploads are no longer allowed for this site')
  }

  return upload_auth.creation
}

const array2hex = (raw: Uint8Array): string =>
  Array.from(raw)
    .map(v => ('0' + v.toString(16)).slice(-2))
    .join('')

const hex2array = (hex: string): Uint8Array =>
  new Uint8Array((hex.match(/.{1,2}/g) as string[]).map(b => parseInt(b, 16)))

export function create_random_hex(length: number): string {
  const raw = new Uint8Array(Math.ceil(length / 2))
  crypto.getRandomValues(raw)
  return array2hex(raw).substr(0, length)
}

const hmac_algo: HmacImportParams = {name: 'HMAC', hash: {name: 'SHA-512'}}
const hmac_key_usage: KeyUsage[] = ['sign', 'verify']

async function get_hmac_secret_key(): Promise<CryptoKey> {
  const raw_key = await HIGH_TMP.get('hmac_secret_key', 'arrayBuffer')
  if (raw_key) {
    return await crypto.subtle.importKey('raw', raw_key, hmac_algo, true, hmac_key_usage)
  } else {
    const secret_key = (await crypto.subtle.generateKey(hmac_algo, true, hmac_key_usage)) as CryptoKey

    const new_raw_key = await crypto.subtle.exportKey('raw', secret_key)
    await HIGH_TMP.put('hmac_secret_key', new_raw_key)
    return secret_key
  }
}


export async function sign_auth(upload_auth: UploadAuth): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(upload_auth))

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
  return 'sk_' + array2hex(signed)
}

async function decode_signed_object(signed: string): Promise<UploadAuth> {
  // substr gets rid of 'sk_' prefix
  const raw_signed = hex2array(signed.substr(3))
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
  return JSON.parse(obj)
}
