import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

type FeedbackBody = {
  category?: unknown
  message?: unknown
  allow_contact?: unknown
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as FeedbackBody | null
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1200) : ''
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 60) : 'GENERAL'
    const allowContact = body.allow_contact === true

    if (!message) {
      return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 })
    }

    const { data: comercioUsuario, error: roleError } = await supabase
      .from('comercio_usuarios')
      .select('id,tenant_id,activo')
      .eq('auth_user_id', user.id)
      .eq('activo', true)
      .limit(1)
      .maybeSingle()

    if (roleError || !comercioUsuario?.tenant_id) {
      return NextResponse.json({ ok: false, error: 'role_not_configured' }, { status: 403 })
    }

    const { error: insertError } = await supabase.from('cliente_feedback').insert({
      tenant_id: comercioUsuario.tenant_id,
      comercio_usuario_id: comercioUsuario.id,
      tipo: 'SUGERENCIA',
      categoria: category || 'GENERAL',
      motivos: [],
      mensaje: message,
      permite_contacto: allowContact,
    })

    if (insertError) {
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
