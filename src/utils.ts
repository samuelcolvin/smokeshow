declare const DEBUG: string | undefined
declare const STORAGE: KVNamespace

export const debug = typeof DEBUG !== 'undefined' && DEBUG === 'TRUE'

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS'

export function simple_response(
  body: string | ReadableStream | ArrayBuffer,
  content_type = 'text/plain',
  expires_in: number | null = null,
): Response {
  return new Response(body, {headers: build_headers(content_type, expires_in)})
}

export function json_response(obj: Record<string, any>): Response {
  return new Response(JSON.stringify(obj, null, 2), {headers: {'content-type': 'application/json'}})
}

export async function cached_proxy(url: string, content_type: string): Promise<Response> {
  const cache_key = `file:${url}`

  const cache_value = await STORAGE.getWithMetadata(cache_key, 'stream')
  if (cache_value.value) {
    return response_from_kv(cache_value as KVFile, 3600)
  }
  console.log(`"${url}" not yet cached, downloading`)
  const r = await fetch(url)
  if (r.status != 200) {
    throw new HttpError(502, `Error getting "${url}", response: ${r.status}`)
  }
  const blob = await r.blob()
  const body = await blob.arrayBuffer()
  await STORAGE.put(cache_key, body, {expirationTtl: 3600 * 24 * 30, metadata: {content_type}})
  return simple_response(body, content_type, 3600)
}

export interface FileMetadata {
  content_type?: string
  hash?: string
  size?: number
}

export interface KVFile {
  value: ReadableStream | null
  metadata: FileMetadata | null
}

export function response_from_kv(cache_value: KVFile, expires: number | null = null, status = 200): Response {
  const metadata: FileMetadata = cache_value.metadata || {}
  return new Response(cache_value.value, {status, headers: build_headers(metadata.content_type, expires)})
}

function build_headers(content_type: string | undefined, expires_in: number | null): Record<string, string> {
  const headers: Record<string, string> = {}
  headers['content-type'] = content_type || 'application/octet-stream'
  if (expires_in != null) {
    headers['expires'] = new Date(Date.now() + expires_in * 1000).toUTCString()
  }
  return headers
}

export class HttpError extends Error {
  status: number
  body: string
  headers: Record<string, string>

  constructor(status: number, body: string, headers: Record<string, string> | undefined = undefined) {
    super(`HTTP Error ${status}: ${body}, headers=${JSON.stringify(headers || {})}`)
    this.status = status
    this.body = body
    this.headers = headers || {}
  }

  response = (): Response => {
    return new Response(`${this.status}: ${this.body}`, {status: this.status, headers: this.headers})
  }
}

export function check_method(request: Request, allow: Method | Method[]): void {
  if (typeof allow == 'string') {
    allow = [allow]
  }
  if (!allow.includes(request.method as Method)) {
    const allow_str = allow.join(',')
    const msg = `Method Not Allowed (allowed: ${allow_str})`
    throw new HttpError(405, msg, {allow: allow_str})
  }
}

export interface RequestExtraInfo {
  url: URL
  match: RegExpMatchArray | boolean
  cleaned_path: string
}

export interface View {
  match: RegExp | string
  allow?: Method | Method[]
  view: {
    (request: Request, info: RequestExtraInfo): Promise<Response>
  }
}

export function clean_path(url: URL): string {
  let path = url.pathname
  if (!path.includes('.') && !path.endsWith('/')) {
    path += '/'
  }
  return path
}

interface KvListItem {
  name: string
  expiration: number
  metadata: {content_type: string; size: number}
}

export async function list_all(prefix: string): Promise<KvListItem[]> {
  const items: KvListItem[] = []
  let value = await STORAGE.list({prefix: prefix})
  while (true) {
    items.push(...(value.keys as KvListItem[]))
    if (value.list_complete) {
      return items
    }
    value = await STORAGE.list({prefix: prefix, cursor: value.cursor})
  }
}
