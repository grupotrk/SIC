import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { computeSubscriptionState } from '@/lib/subscriptionLifecycle'

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

export async function GET(req: Request) {
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 })
    }

    const { data: usuarioComercio, error: userRoleError } = await supabase
      .from('comercio_usuarios')
      .select('id,tenant_id,rol,activo')
      .eq('auth_user_id', user.id)
      .eq('activo', true)
      .limit(1)
      .maybeSingle()

    if (userRoleError || !usuarioComercio?.tenant_id) {
      return NextResponse.json({ ok: false, error: 'role_not_configured' }, { status: 403 })
    }

    const { data: comercio, error: commerceError } = await supabase
      .from('comercios')
      .select('tenant_id,estado_suscripcion,suscripcion_vence_at,solo_descarga_hasta,baja_solicitada_at,activo,depurado_at')
      .eq('tenant_id', usuarioComercio.tenant_id)
      .maybeSingle()

    if (commerceError || !comercio) {
      return NextResponse.json({ ok: false, error: 'commerce_not_found' }, { status: 404 })
    }

    const computed = computeSubscriptionState(comercio)

    return NextResponse.json(
      {
        ok: true,
        role: usuarioComercio.rol,
        tenant_id: usuarioComercio.tenant_id,
        subscription: computed,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
