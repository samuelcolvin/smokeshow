import {HttpError} from './utils'
import {SITES_PER_DAY, MAX_SITE_SIZE} from './constants'

declare const postgrest_root: string
declare const postgrest_apikey: string

export async function create_site_check(public_key: string, auth_key: string): Promise<number> {
  const recent_site = (await postgrest_get('/rpc/recent_sites', {auth_key})) as number

  if (recent_site > SITES_PER_DAY) {
    // too many site created in the last 24 hours
    throw new HttpError(429, `You've exceeded the 24h creation limit of ${SITES_PER_DAY} sites.`)
  }
  await postgrest_post('/sites', {public_key, auth_key})
  return recent_site
}

export async function new_file_check(public_key: string, file_size: number): Promise<number> {
  const data = {public_key, file_size, size_limit: MAX_SITE_SIZE}
  const total_size = await postgrest_post('/rpc/new_file', data)

  if (total_size == null) {
    throw new HttpError(429, `You've exceeded the site size limit of ${MAX_SITE_SIZE}.`)
  }
  return total_size as number
}

const allowed_responses = new Set([200, 201])

async function postgrest_get(path: string, args: Record<string, string | number> = {}): Promise<any> {
  const request_url = postgrest_root + path + build_args(args)
  const r = await fetch(request_url, {headers: {apikey: postgrest_apikey}})
  if (!allowed_responses.has(r.status)) {
    const response_text = await r.text()
    console.error('error making GET request to database', {request_url, response_status: r.status, response_text})
    throw new HttpError(502, `error making request to database, response ${r.status}`)
  }
  return await r.json()
}

async function postgrest_post(path: string, data: Record<string, any>): Promise<any> {
  const request_url = postgrest_root + path
  const r = await fetch(request_url, {
    method: 'POST',
    headers: {apikey: postgrest_apikey, 'content-type': 'application/json'},
    body: JSON.stringify(data),
  })
  if (!allowed_responses.has(r.status)) {
    const response_text = await r.text()
    console.error('error making POST request to database', {request_url, response_status: r.status, response_text})
    throw new HttpError(502, `error making request to database, response ${r.status}`)
  }
  try {
    return await r.json()
  } catch (e) {
    return null
  }
}

function build_args(args: Record<string, string | number>): string {
  const arg_list: string[] = []

  const add_arg = (n: string, v: string | number) =>
    arg_list.push(encodeURIComponent(n) + '=' + encodeURIComponent(v.toString()))

  for (const [name, value] of Object.entries(args)) {
    if (Array.isArray(value)) {
      for (const value_ of value) {
        add_arg(name, value_)
      }
    } else if (value !== null && value !== undefined) {
      add_arg(name, value)
    }
  }
  if (arg_list.length > 0) {
    return '?' + arg_list.join('&')
  }
  return ''
}
