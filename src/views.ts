import {html_response, check_method} from './utils'

const INDEX_HTML = `
<h1>Index</h1>

<p>This is the index page, it doesn't say much interesting yet</p>
`

export async function index(request: Request): Promise<Response> {
  check_method(request, 'GET')
  return html_response(INDEX_HTML)
}
