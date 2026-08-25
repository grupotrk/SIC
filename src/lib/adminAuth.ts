import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

function mustGetEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function verifyToken(token: string, secret: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [encoded, sig] = parts
  const expected = createHmac('sha256', secret).update(encoded).digest()

  let provided: Buffer
  try {
    provided = Buffer.from(sig, 'base64url')
  } catch {
    return false
  }

  if (provided.length !== expected.length) return false
  if (!timingSafeEqual(provided, expected)) return false

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as {
      sub?: string
      exp?: number
    }
    return payload.sub === 'admin' && typeof payload.exp === 'number' && Date.now() < payload.exp
  } catch {
    return false
  }
}

export async function hasValidAdminSession(): Promise<boolean> {
  const secret = mustGetEnv('ADMIN_JWT_SECRET')
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value ?? ''
  if (!token) return false
  return verifyToken(token, secret)
}
