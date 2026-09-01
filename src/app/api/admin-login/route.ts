import { NextResponse } from 'next/server'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { getSupabaseAdmin, getSupabaseAuthVerifier } from '@/lib/supabaseServer'
import { signAdminToken } from '@/lib/adminAuth'

function maybeGetEnv(name: string): string { return (process.env[name] || '').trim() }
function mustGetEnv(name: string): string { const v = maybeGetEnv(name); if (!v) throw new Error(`Missing env var: ${name}`); return v }

type AttemptState = { fails: number; blockedUntil: number }
const attempts = new Map<string, AttemptState>()
const MAX_ATTEMPTS = 5
const BLOCK_MS = 15 * 60 * 1000

function safeEqual(a: string, b: string): boolean {
  const key = randomBytes(32)
  const ha = createHmac('sha256', key).update(a).digest()
  const hb = createHmac('sha256', key).update(b).digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}
function getClientKey(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown'
}
function jsonNoStore(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } })
}
function verifyPassword(password: string, encodedHash: string): boolean {
  const separator = encodedHash.includes(':') ? ':' : '$'
  const parts = encodedHash.split(separator)
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, saltHex, hashHex] = parts
  const expected = Buffer.from(hashHex, 'hex')
  if (!expected.length) return false
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
function setAdminCookie(res: NextResponse, payload: Parameters<typeof signAdminToken>[0]) {
  const token = signAdminToken(payload, mustGetEnv('ADMIN_JWT_SECRET'))
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400,
    path: '/',
  })
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
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!username || !password) return jsonNoStore({ ok: false, error: 'missing_fields' }, 400)

    // 1) Cuenta bootstrap legacy. Se conserva como acceso de emergencia durante la migración.
    const legacyUser = maybeGetEnv('ADMIN_USERNAME')
    const legacyHash = maybeGetEnv('ADMIN_PASSWORD_HASH')
    if (legacyUser && legacyHash && safeEqual(username, legacyUser) && verifyPassword(password, legacyHash)) {
      attempts.delete(clientKey)
      const res = jsonNoStore({ ok: true, source: 'legacy', requires_password_change: false }, 200)
      setAdminCookie(res, { sub: 'admin', exp: Date.now() + 86400000, source: 'legacy', nombre: 'Admin SIDEA' })
      return res
    }

    // 2) SUPERADMIN individual en Supabase Auth.
    const auth = getSupabaseAuthVerifier()
    const signedIn = await auth.auth.signInWithPassword({ email: username.toLowerCase(), password })
    const user = signedIn.data.user
    if (!user?.id || signedIn.error) throw new Error('invalid_credentials')

    const db = getSupabaseAdmin()
    const adminRow = await db
      .from('super_admin_users')
      .select('id,activo,email,metadata')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (adminRow.error || !adminRow.data?.activo) throw new Error('invalid_credentials')

    const metadata = (adminRow.data.metadata || {}) as Record<string, unknown>
    const nombre = String(metadata.nombre || user.user_metadata?.nombre || user.email || 'Superadmin')
    const mustChangePassword = Boolean(user.user_metadata?.must_change_password ?? metadata.must_change_password)

    attempts.delete(clientKey)
    const res = jsonNoStore({ ok: true, source: 'supabase', requires_password_change: mustChangePassword }, 200)
    setAdminCookie(res, {
      sub: 'admin', exp: Date.now() + 86400000, source: 'supabase', authUserId: user.id,
      email: user.email || adminRow.data.email, nombre, mustChangePassword,
    })
    return res
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }
    const nextFails = state.fails + 1
    attempts.set(clientKey, nextFails >= MAX_ATTEMPTS
      ? { fails: 0, blockedUntil: Date.now() + BLOCK_MS }
      : { fails: nextFails, blockedUntil: 0 })
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))
    return jsonNoStore({ ok: false, error: 'invalid_credentials' }, 401)
  }
}
