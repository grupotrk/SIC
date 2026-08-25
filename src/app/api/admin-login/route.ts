import { NextResponse } from 'next/server'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

function mustGetEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

type AttemptState = {
  fails: number
  blockedUntil: number
}

const attempts = new Map<string, AttemptState>()
const MAX_ATTEMPTS = 5
const BLOCK_MS = 15 * 60 * 1000

// Comparación en tiempo constante para prevenir timing attacks
function safeEqual(a: string, b: string): boolean {
  const key = randomBytes(32)
  const ha = createHmac('sha256', key).update(a).digest()
  const hb = createHmac('sha256', key).update(b).digest()
  // require both buffers to match AND have the same length
  return timingSafeEqual(ha, hb) && a.length === b.length
}

function getClientKey(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = req.headers.get('x-real-ip')?.trim()
  return xff || realIp || 'unknown'
}

function jsonNoStore(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}

function signToken(payload: string, secret: string): string {
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

function verifyPassword(password: string, encodedHash: string): boolean {
  // Formato recomendado: scrypt:<salt_hex>:<hash_hex>
  // Compatibilidad legacy: scrypt$<salt_hex>$<hash_hex>
  const separator = encodedHash.includes(':') ? ':' : '$'
  const parts = encodedHash.split(separator)
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, saltHex, hashHex] = parts
  let expected: Buffer
  try {
    expected = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }
  if (expected.length === 0) return false
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

export async function POST(req: Request) {
  const clientKey = getClientKey(req)
  const state = attempts.get(clientKey) ?? { fails: 0, blockedUntil: 0 }
  if (state.blockedUntil > Date.now()) {
    const retryAfterSeconds = Math.ceil((state.blockedUntil - Date.now()) / 1000)
    const res = jsonNoStore({ ok: false, error: 'too_many_attempts' }, 429)
    res.headers.set('Retry-After', String(retryAfterSeconds))
    return res
  }

  try {
    const body = (await req.json().catch(() => null)) as null | Record<string, unknown>
    if (!body) {
      return jsonNoStore({ ok: false, error: 'invalid_input' }, 400)
    }

    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!username || !password) {
      return jsonNoStore({ ok: false, error: 'missing_fields' }, 400)
    }

    const adminUser = mustGetEnv('ADMIN_USERNAME')
    const adminPassHash = mustGetEnv('ADMIN_PASSWORD_HASH')
    const secret = mustGetEnv('ADMIN_JWT_SECRET')

    const userMatch = safeEqual(username, adminUser)
    const passMatch = verifyPassword(password, adminPassHash)

    if (!userMatch || !passMatch) {
      // Delay aleatorio para dificultar brute-force
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500))

      const nextFails = state.fails + 1
      if (nextFails >= MAX_ATTEMPTS) {
        attempts.set(clientKey, { fails: 0, blockedUntil: Date.now() + BLOCK_MS })
      } else {
        attempts.set(clientKey, { fails: nextFails, blockedUntil: 0 })
      }

      return jsonNoStore({ ok: false, error: 'invalid_credentials' }, 401)
    }

    attempts.delete(clientKey)

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000
    const token = signToken(JSON.stringify({ sub: 'admin', exp: expiresAt }), secret)

    const res = jsonNoStore({ ok: true }, 200)
    res.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400,
      path: '/',
    })
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }
    return jsonNoStore({ ok: false, error: 'unexpected' }, 500)
  }
}
