import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { computeSubscriptionState } from '@/lib/subscriptionLifecycle'

type CancelBody = {
  reasons?: unknown
  details?: unknown
  allow_contact?: unknown
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

function sanitizeReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as CancelBody | null
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    const reasons = sanitizeReasons(body.reasons)
    if (reasons.length === 0) {
      return NextResponse.json({ ok: false, error: 'reasons_required' }, { status: 400 })
    }

    const details = typeof body.details === 'string' ? body.details.trim().slice(0, 1000) : ''
    const allowContact = body.allow_contact === true

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
      .select('id,tenant_id,rol,activo')
      .eq('auth_user_id', user.id)
      .eq('activo', true)
      .limit(1)
      .maybeSingle()

    if (roleError || !comercioUsuario?.tenant_id) {
      return NextResponse.json({ ok: false, error: 'role_not_configured' }, { status: 403 })
    }

    if (comercioUsuario.rol !== 'OWNER' && comercioUsuario.rol !== 'SUPERADMIN') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const now = new Date()
    const { error: updateError } = await supabase
      .from('comercios')
      .update({
        estado_suscripcion: 'BAJA_SOLICITADA',
        baja_solicitada_at: now.toISOString(),
        baja_motivos: reasons,
        baja_detalle: details || null,
        baja_permite_contacto: allowContact,
      })
      .eq('tenant_id', comercioUsuario.tenant_id)

    if (updateError) {
      return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
    }

    await supabase.from('cliente_feedback').insert({
      tenant_id: comercioUsuario.tenant_id,
      comercio_usuario_id: comercioUsuario.id,
      tipo: 'BAJA',
      categoria: 'BOTON_ARREPENTIMIENTO',
      motivos: reasons,
      mensaje: details || null,
      permite_contacto: allowContact,
    })

    const { data: comercio } = await supabase
      .from('comercios')
      .select('estado_suscripcion,suscripcion_vence_at,solo_descarga_hasta,baja_solicitada_at,activo,depurado_at')
      .eq('tenant_id', comercioUsuario.tenant_id)
      .maybeSingle()

    return NextResponse.json(
      {
        ok: true,
        message: 'Baja solicitada correctamente',
        subscription: computeSubscriptionState(comercio ?? null),
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
