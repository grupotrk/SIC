import { NextResponse } from 'next/server'

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 0,
}

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 })

  response.cookies.set('trikode_role', '', COOKIE_OPTS)
  response.cookies.set('trikode_session', '', COOKIE_OPTS)

  // Limpia posibles cookies de auth de Supabase si existen.
  response.cookies.set('sb-access-token', '', COOKIE_OPTS)
  response.cookies.set('sb-refresh-token', '', COOKIE_OPTS)

  return response
}
