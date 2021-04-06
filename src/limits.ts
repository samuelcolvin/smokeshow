import {HttpError} from './utils'
import {SITES_PER_DAY, MAX_SITE_SIZE} from './constants'

declare const postgrest_root: string
declare const postgrest_apikey: string

export async function create_site_check(
  public_key: string,
  auth_key: string,
  user_agent: string,
  ip_address: string,
): Promise<number> {
  const data = {public_key, auth_key, max_sites: SITES_PER_DAY, user_agent, ip_address}
  const recent_sites = await postgrest_post('check_new_site', data)

  if (recent_sites == null) {
    // too many site created in the last 24 hours
    throw new HttpError(429, `You've exceeded the site creation limit of ${SITES_PER_DAY} sites.`)
  }
  return recent_sites as number
}

export async function new_file_check(public_key: string, file_size: number): Promise<number> {
  const data = {public_key, file_size, size_limit: MAX_SITE_SIZE}
  const total_size = await postgrest_post('check_new_file', data)

  if (total_size == null) {
    throw new HttpError(429, `You've exceeded the site size limit of ${MAX_SITE_SIZE}.`)
  }
  return total_size as number
}

const allowed_responses = new Set([200, 201])

async function postgrest_post(function_name: string, data: Record<string, any>): Promise<any> {
  const request_url = `${postgrest_root}/rest/v1/rpc/${function_name}`
  const r = await fetch(request_url, {
    method: 'POST',
    headers: {apikey: postgrest_apikey, 'content-type': 'application/json'},
    body: JSON.stringify(data),
  })
  const response_text = await r.text()
  if (!allowed_responses.has(r.status)) {
    console.error('error making POST request to database', {request_url, response_status: r.status, response_text})
    throw new HttpError(502, `error making request to database, response ${r.status}`)
  }
  if (response_text) {
    return JSON.parse(response_text)
  } else {
    return null
  }
}
