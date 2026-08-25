/**
 * HMAC-SHA256 signing for server-set cookies.
 * Prevents client-side tampering with the `trikode_role` cookie.
 *
 * Format: "<value>.<base64url_signature>"
 * Secret: ADMIN_JWT_SECRET (already in .env)
 *
 * ⚠️ Uses only Web Crypto APIs — compatible with both Node.js and Edge Runtime.
 */

const encoder = new TextEncoder()

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Signs a cookie value. Returns "<value>.<signature>".
 * Call this on the server when setting the cookie.
 */
export async function signCookieValue(value: string): Promise<string> {
  const secret = process.env.ADMIN_JWT_SECRET
  if (!secret) return value // fallback sin firma si no hay secret (ej: dev sin .env)

  const key = await getKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return `${value}.${bufferToBase64Url(sig)}`
}

/**
 * Verifies and extracts the original value from a signed cookie.
 * Returns the value if valid, null if tampered.
 * If no ADMIN_JWT_SECRET is configured, returns the value as-is (dev mode).
 */
export async function verifyCookieValue(signed: string): Promise<string | null> {
  const secret = process.env.ADMIN_JWT_SECRET
  if (!secret) return signed // dev sin secret: aceptar sin verificar

  const lastDot = signed.lastIndexOf('.')
  if (lastDot === -1) return null

  const value = signed.slice(0, lastDot)
  const sigB64url = signed.slice(lastDot + 1)

  try {
    const key = await getKey(secret)
    const sigBuffer = base64UrlToBuffer(sigB64url)
    const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, encoder.encode(value))
    return valid ? value : null
  } catch {
    return null
  }
}
