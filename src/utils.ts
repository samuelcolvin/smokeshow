declare const DEBUG: string | undefined

export const debug = typeof DEBUG !== 'undefined' && DEBUG === 'TRUE'

export function html_response(html: string): Response {
  return new Response(html, {headers: {'Content-Type': 'text/html'}})
}

interface ErrorExtra {
  allow?: string
}

export class HttpError extends Error {
  status: number
  body: string
  extra: ErrorExtra

  constructor(status: number, body: string, extra: ErrorExtra | null = null) {
    super(`HTTP Error ${status}: ${body}`)
    this.status = status
    this.body = body
    this.extra = extra || {}
  }

  response = (): Response => {
    const headers: Record<string, string> = {}
    if (this.status == 405) {
      headers['allow'] = this.extra.allow || 'GET'
    }
    return new Response(this.body, {status: this.status, headers})
  }
}

export function check_method(request: Request, allow: string | string[]): void {
  if (typeof allow == 'string') {
    allow = [allow]
  }
  if (!allow.includes(request.method)) {
    const allow_str = allow.join(',')
    const msg = `405: Method Not Allowed (allowed: ${allow_str})`
    throw new HttpError(405, msg, {allow: allow_str})
  }
}
