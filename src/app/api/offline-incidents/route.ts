import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

type OfflineIncidentPayload = {
  reportId: string
  offlineDetectedAt: string
  reportCreatedAt: string
  connectionRestoredAt: string
  syncedAt: string
  pendingSalesCount: number
  syncedSalesCount: number
  turnoId?: string | null
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const body = (await req.json()) as Partial<OfflineIncidentPayload>

    if (!body.reportId || !body.offlineDetectedAt || !body.reportCreatedAt || !body.connectionRestoredAt || !body.syncedAt) {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 })
    }

    const { data: usuarioComercio, error: roleError } = await supabase
      .from('comercio_usuarios')
      .select('id,tenant_id,rol,activo')
      .eq('auth_user_id', user.id)
      .eq('activo', true)
      .limit(1)
      .maybeSingle()

    if (roleError || !usuarioComercio?.tenant_id) {
      return NextResponse.json({ ok: false, error: 'role_not_configured' }, { status: 403 })
    }

    const { error: insertError } = await supabase.from('auditoria').insert({
      tenant_id: usuarioComercio.tenant_id,
      tabla: 'sistema',
      operacion: 'OFFLINE',
      usuario_id: user.id,
      datos_nuevos: {
        tipo_evento: 'REPORTE_RED_CAIDA',
        origen: 'employee_panel',
        report_id: body.reportId,
        comercio_usuario_id: usuarioComercio.id,
        rol: usuarioComercio.rol,
        offline_detected_at: body.offlineDetectedAt,
        report_created_at: body.reportCreatedAt,
        connection_restored_at: body.connectionRestoredAt,
        synced_at: body.syncedAt,
        pending_sales_count: body.pendingSalesCount ?? 0,
        synced_sales_count: body.syncedSalesCount ?? 0,
        turno_id: body.turnoId ?? null,
        detalle: 'La red se interrumpio y las ventas se sincronizaron al restablecer la conexion.',
      },
    })

    if (insertError) {
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}