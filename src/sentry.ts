import {FullContext} from './utils'

interface Extra {
  level?: string
  extra?: Record<string, any>
  fingerprint?: string[]
}

export function captureMessage(
  context: FullContext,
  message: string,
  {level = 'info', extra = {}}: Extra = {},
): Promise<void> {
  return _capture(context, {message, level, extra})
}

export function captureException(
  context: FullContext,
  exc: Error,
  {level = 'error', extra = {}}: Extra = {},
): Promise<void> {
  const message = exc.toString() || exc.message || 'Unknown error'
  return _capture(context, {
    exception: {
      mechanism: {handled: true, type: 'generic'},
      values: [
        {
          type: 'Error',
          value: message,
          stacktrace: {frames: get_frames(exc.stack)},
        },
      ],
    },
    message,
    level,
    extra,
  })
}

interface Frame {
  in_app: boolean
  filename: string
  function: string | undefined
  lineno: number
  colno: number
}

interface SentryData {
  platform: string
  logger: string
  environment: string
  fingerprint: string[]
  user: {ip_address: string}
  request: {url: string; method: string; headers: Record<string, string>}
  exception?: {
    mechanism: {handled: boolean; type: string}
    values: {type: string; value: string; stacktrace: {frames: Frame[]}}[]
  }
  message?: string
  level?: string
  extra: Record<string, any>
}

async function _capture(context: FullContext, data: Partial<SentryData>): Promise<void> {
  const {request} = context
  const sentry_data: SentryData = Object.assign(
    {
      platform: 'javascript',
      logger: 'cloudflare',
      environment: context.env.ENVIRONMENT,
      fingerprint: [data.message || 'null'],
      user: {
        ip_address: request.headers.get('CF-Connecting-IP'),
      },
      request: {
        url: request.url,
        method: request.method,
        headers: headers_object(request.headers),
      },
      extra: {},
    },
    data,
  )
  sentry_data.extra.cloudflare = request.cf

  console.error('sentry data:', sentry_data)

  if (!context.env.SENTRY_DSN) {
    console.error('no sentry dsn')
    return
  }

  // if (this.release) {
  //   defaults.release = this.release
  // }
  const m = context.env.SENTRY_DSN.match(/^https:\/\/(.+?)@(.+?)\.ingest\.sentry\.io\/(.+)/)
  const [, sentry_key, , app] = m as RegExpMatchArray

  const params = {
    sentry_key,
    sentry_version: 7,
    sentry_client: 'cloudflare-worker-custom',
  }
  const args = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const sentry_url = `https://sentry.io/api/${app}/store/?${args}`

  await fetch(sentry_url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(sentry_data),
  })
}

export const headers_object = (headers: Headers): Record<string, string> =>
  Object.assign({}, ...Array.from(headers.entries()).map(([k, v]) => ({[k]: v})))

function get_frames(stack: string | undefined): Frame[] {
  if (!stack) {
    return []
  }
  const lines = stack.split('\n')
  lines.splice(0, 1)
  return lines
    .reverse()
    .filter(line => line.match(/^ {4}at /))
    .map(line => {
      let filename, func, lineno, colno
      const m1 = line.match(/^ +at (\S+) \((.+?):(\d+):(\d+)\)/)
      if (m1) {
        ;[, func, filename, lineno, colno] = m1
      } else {
        ;[, filename, lineno, colno] = line.match(/^ +at (.+?):(\d+):(\d+)/)
      }
      return {
        in_app: true,
        filename: '~/' + filename,
        function: func,
        lineno: parseInt(lineno),
        colno: parseInt(colno),
      }
    })
}
