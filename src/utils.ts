declare const DEBUG: string | undefined

export const debug = typeof DEBUG !== 'undefined' && DEBUG === 'TRUE'

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS'

export function html_response(html: string): Response {
  return new Response(html, {headers: {'content-type': 'text/html'}})
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

export interface View {
  match: RegExp | string
  allow: Method | Method[]
  skip_405?: boolean
  view: {
    (request: Request, info: RequestInfo): Promise<Response>
  }
}

export interface RequestInfo {
  url: URL
  match: RegExpMatchArray | boolean
  computed_path: string
}
