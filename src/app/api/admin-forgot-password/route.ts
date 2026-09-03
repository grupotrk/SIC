import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseAuthVerifier } from '@/lib/supabaseServer'

function readStringField(body: unknown, field: string) {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : ''
}

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null)
  const email = readStringField(body, 'email').trim().toLowerCase()

  const generic = () =>
    NextResponse.json(
      { ok: true, message: 'Si el correo pertenece a un administrador activo, recibirá instrucciones.' },
      { headers: { 'Cache-Control': 'no-store' } },
    )

  if (!email || !email.includes('@')) return generic()

  try {
    const db = getSupabaseAdmin()
    const row = await db.from('super_admin_users').select('activo').eq('email', email).maybeSingle()
    if (!row.data?.activo) return generic()

    const origin = new URL(req.url).origin
    await getSupabaseAuthVerifier().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/set-password`,
    })
    return generic()
  } catch {
    return generic()
  }
}
