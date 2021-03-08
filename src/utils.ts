declare const DEBUG: string | undefined

export const debug = typeof DEBUG !== 'undefined' && DEBUG === 'TRUE'

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS'

export function text_response(body: string, content_type = 'text/plain'): Response {
  return new Response(body, {headers: {'content-type': content_type}})
}

export function json_response(obj: Record<string, any>): Response {
  return new Response(JSON.stringify(obj, null, 2), {headers: {'content-type': 'application/json'}})
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
  allow: Method | Method[]
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
