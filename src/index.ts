import {captureException} from './sentry'
import {views} from './views'
import {debug, HttpError, check_method} from './utils'

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
  for (const view of views) {
    if (typeof view.match == 'string') {
      if (view.match != url.pathname) {
        continue
      }
    } else if (!view.match(url)) {
      continue
    }
    check_method(request, view.method)
    return view.view(request, url)
  }
  throw new HttpError(404, 'Page not found')
}
