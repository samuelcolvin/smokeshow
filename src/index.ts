import {captureException} from './sentry'
import {views, site_path_regex} from './views'
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

function smart_referrer_redirect(request: Request, url: URL): string | undefined {
  // magic to redirect requests where a site had a link to a resource assuming it was deploy on route
  // eg. a request to /favicon.ico with a referrer .../<site pk>/... will be redirected to .../<site pk>/favicon.ico

  if (request.method != 'GET') {
    return
  }

  if (url.pathname.match(site_path_regex)) {
    // request is already to a site
    return
  }
  const referrer = request.headers.get('referer')
  if (!referrer) {
    // no referer header
    return
  }
  const referrer_url = new URL(referrer)
  if (referrer_url.origin != url.origin) {
    // referrer is not smokeshow
    return
  }
  const match = clean_path(referrer_url).match(site_path_regex)
  if (match) {
    return `${url.origin}/${match[1]}${url.pathname}`
  }
}
