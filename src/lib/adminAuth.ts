import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

function mustGetEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export type AdminSession = {
  sub: 'admin'
  exp: number
  source: 'legacy' | 'supabase'
  authUserId?: string
  email?: string
  nombre?: string
  mustChangePassword?: boolean
}

function signEncoded(encoded: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

export function signAdminToken(payload: AdminSession, secret: string): string {
  return signEncoded(Buffer.from(JSON.stringify(payload)).toString('base64url'), secret)
}

function verifyToken(token: string, secret: string): AdminSession | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encoded, sig] = parts
  const expected = createHmac('sha256', secret).update(encoded).digest()

  let provided: Buffer
  try {
    provided = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }

  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Partial<AdminSession>
    if (payload.sub !== 'admin' || typeof payload.exp !== 'number' || Date.now() >= payload.exp) return null
    return {
      sub: 'admin',
      exp: payload.exp,
      source: payload.source === 'supabase' ? 'supabase' : 'legacy',
      authUserId: payload.authUserId,
      email: payload.email,
      nombre: payload.nombre,
      mustChangePassword: Boolean(payload.mustChangePassword),
    }
  } catch {
    return null
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const secret = mustGetEnv('ADMIN_JWT_SECRET')
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value ?? ''
  if (!token) return null
  return verifyToken(token, secret)
}

export async function hasValidAdminSession(): Promise<boolean> {
  return Boolean(await getAdminSession())
}
