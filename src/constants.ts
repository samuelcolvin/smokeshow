declare const __TESTING__: string | undefined
export const TESTING = typeof __TESTING__ != 'undefined' && __TESTING__ === 'TRUE'

export const AUTH_HASH_THRESHOLD = TESTING ? 2 ** 260 : 2 ** 234
export const INFO_FILE_NAME = '/.smokeshow.json'
export const PUBLIC_KEY_LENGTH = 20
export const SITE_TTL = TESTING ? 90 * 1000 : 30 * 24 * 3600 * 1000
export const UPLOAD_TTL = TESTING ? 70 * 1000 : 3600 * 1000
export const SITES_PER_DAY = 50
export const MAX_SITE_SIZE = 30 * 1024 ** 2
