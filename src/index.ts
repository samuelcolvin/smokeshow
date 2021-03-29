import {captureException} from './sentry'
import {views, smart_referrer_redirect} from './views'
import {debug, HttpError, check_method, clean_path} from './utils'

addEventListener('fetch', e => e.respondWith(handle(e)))

async function handle(event: FetchEvent) {
  const {request} = event

  try {
    return await route(event)
  } catch (exc) {
    if (exc instanceof HttpError) {
      console.warn(exc.message)
      return exc.response()
    }
    console.error('error handling request:', request, exc)
    captureException(event, exc)
    const body = debug ? `\nError occurred on the edge:\n\n${exc.message}\n${exc.stack}\n` : 'Edge Server Error'
    return new Response(body, {status: 500})
  }
}

async function route(event: FetchEvent) {
  const {request} = event
  const url = new URL(request.url)
  const cleaned_path = clean_path(url)

  const redirect_url = smart_referrer_redirect(request, url)
  if (redirect_url) {
    return Response.redirect(redirect_url, 307)
  }

  for (const view of views) {
    let match
    if (typeof view.match == 'string') {
      match = view.match == cleaned_path
    } else {
      match = cleaned_path.match(view.match)
    }
    if (!match) {
      continue
    }

    check_method(request, view.allow || 'GET')

    return view.view(request, {url, match, cleaned_path})
  }
  throw new HttpError(404, `Page not found for "${url.pathname}"`)
}
