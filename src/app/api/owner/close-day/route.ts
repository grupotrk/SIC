import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('authorization')?.substring(7)
    if (!token) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // Verificar token y obtener usuario
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData.user) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 })
    }

    // Verificar que el usuario es OWNER activo y obtener su tenant + comercio_usuario_id
    const { data: owner, error: ownerError } = await supabase
      .from('comercio_usuarios')
      .select('id, tenant_id')
      .eq('auth_user_id', userData.user.id)
      .eq('rol', 'OWNER')
      .eq('activo', true)
      .single()

    if (ownerError || !owner) {
      return NextResponse.json({ ok: false, error: 'not_owner' }, { status: 403 })
    }

    const { tenantId, fecha_operativa } = await req.json() as {
      tenantId?: string
      fecha_operativa?: string
    }

    // Usar fecha del servidor si el cliente no la envió (más seguro)
    const fecha = fecha_operativa ?? new Date().toISOString().split('T')[0]

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 })
    }

    // Validar que el tenant del body coincide con el del owner (defensa extra)
    if (tenantId && tenantId !== owner.tenant_id) {
      return NextResponse.json({ ok: false, error: 'tenant_mismatch' }, { status: 403 })
    }

    // Verificar si ya existe cierre para esta fecha
    const { data: existing } = await supabase
      .from('cierres_diarios')
      .select('id, created_at')
      .eq('tenant_id', owner.tenant_id)
      .eq('fecha_operativa', fecha)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: 'already_closed',
          mensaje: `Ya existe un cierre registrado para el ${fecha}.`,
        },
        { status: 409 }
      )
    }

    // Obtener los totales del día desde la vista resumen_cierre_diario
    const { data: resumen, error: resumenError } = await supabase
      .from('resumen_cierre_diario')
      .select('total_ventas, total_general, total_efectivo, total_tarjeta, total_anuladas, total_devoluciones, total_transferencia, total_mercado_pago')
      .eq('tenant_id', owner.tenant_id)
      .eq('fecha_operativa', fecha)
      .maybeSingle()

    if (resumenError) {
      return NextResponse.json({ ok: false, error: 'resumen_error' }, { status: 500 })
    }

    // Insertar el cierre con service role (sin problemas de RLS)
    const { error: insertError } = await supabase
      .from('cierres_diarios')
      .insert({
        tenant_id: owner.tenant_id,
        fecha_operativa: fecha,
        cerrado_por: owner.id,
        total_efectivo: resumen?.total_efectivo ?? 0,
        total_tarjeta: resumen?.total_tarjeta ?? 0,
        total_transferencia: resumen?.total_transferencia ?? 0,
        total_mercado_pago: resumen?.total_mercado_pago ?? 0,
        total_general: resumen?.total_general ?? 0,
        total_ventas: resumen?.total_ventas ?? 0,
        total_anuladas: resumen?.total_anuladas ?? 0,
        total_devoluciones: resumen?.total_devoluciones ?? 0,
      })

    if (insertError) {
      // Captura el caso de duplicado en caso de race condition
      if (insertError.code === '23505') {
        return NextResponse.json(
          { ok: false, error: 'already_closed', mensaje: `Ya existe un cierre registrado para el ${fecha}.` },
          { status: 409 }
        )
      }
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, fecha }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
