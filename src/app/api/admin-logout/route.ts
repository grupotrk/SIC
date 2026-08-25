import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
  )
  res.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
  return res
}
