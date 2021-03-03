import {captureException} from './sentry'
import {index} from './views'
import {debug, HttpError} from './utils'

addEventListener('fetch', e => e.respondWith(handle(e)))

async function handle(event: FetchEvent) {
  const {request} = event
  console.debug(`${request.method} ${request.url}`)

  try {
    return await route(event)
  } catch (exc) {
    if (exc instanceof HttpError) {
      console.warn(exc)
      return exc.response()
    }
    console.error('error handling request:', request)
    console.error('error:', exc)
    captureException(event, exc)
    const body = debug ? `\nError occurred on the edge:\n\n${exc.message}\n${exc.stack}\n` : 'Edge Server Error'
    return new Response(body, {status: 500})
  }
}

async function route(event: FetchEvent) {
  const {request} = event
  const url = new URL(request.url)
  if (url.pathname === '/') {
    return await index(request)
  }
  throw new HttpError(404, '404: Page not found')
}
