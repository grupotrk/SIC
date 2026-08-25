import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseAuthVerifier } from '@/lib/supabaseServer'

interface SaleRow {
  estado: string | null
  metodo_pago: string | null
  total: number | string | null
}

type Member = { id: string; tenant_id: string; rol: string; activo: boolean }

async function resolveMember(req: NextRequest): Promise<{ member: Member; supabase: ReturnType<typeof getSupabaseAdmin> } | { error: NextResponse }> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return { error: NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }) }

  const verifier = getSupabaseAuthVerifier()
  const { data: userData, error: authError } = await verifier.auth.getUser(authHeader.substring(7))
  if (authError || !userData.user) return { error: NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 }) }

  const supabase = getSupabaseAdmin()
  const { data: member, error: memberError } = await supabase
    .from('comercio_usuarios')
    .select('id, tenant_id, rol, activo')
    .eq('auth_user_id', userData.user.id)
    .eq('activo', true)
    .maybeSingle()

  if (memberError || !member) return { error: NextResponse.json({ ok: false, error: 'user_not_linked' }, { status: 403 }) }
  if (!['EMPLOYEE', 'OWNER', 'SUPERADMIN'].includes(member.rol)) return { error: NextResponse.json({ ok: false, error: 'role_not_allowed' }, { status: 403 }) }
  return { member: member as Member, supabase }
}

function summarizeSales(ventas: SaleRow[]) {
  return ventas.reduce((acc, venta) => {
    if (venta.estado !== 'COMPLETADA') return acc
    const total = Number(venta.total ?? 0)
    acc.totalGeneral += total
    acc.transacciones += 1
    if (venta.metodo_pago === 'EFECTIVO') acc.totalEfectivo += total
    else if (venta.metodo_pago === 'TARJETA') acc.totalTarjeta += total
    else if (venta.metodo_pago === 'TRANSFERENCIA') acc.totalTransferencia += total
    else if (venta.metodo_pago === 'BILLETERA' || venta.metodo_pago === 'MERCADO_PAGO') acc.totalBilletera += total
    else if (venta.metodo_pago === 'QR') acc.totalQr += total
    return acc
  }, { totalGeneral: 0, totalEfectivo: 0, totalTarjeta: 0, totalTransferencia: 0, totalBilletera: 0, totalQr: 0, transacciones: 0 })
}

async function getShiftAndSummary(supabase: ReturnType<typeof getSupabaseAdmin>, member: Member, turnoId: string) {
  const { data: turno, error: turnoError } = await supabase
    .from('turnos')
    .select('*')
    .eq('id', turnoId)
    .eq('tenant_id', member.tenant_id)
    .eq('comercio_usuario_id', member.id)
    .maybeSingle()
  if (turnoError || !turno) return { turno: null, totals: null }

  const { data: ventas, error: ventasError } = await supabase
    .from('ventas')
    .select('estado, metodo_pago, total')
    .eq('tenant_id', member.tenant_id)
    .eq('turno_id', turno.id)
  if (ventasError) throw new Error(ventasError.message)

  return { turno, totals: summarizeSales((ventas ?? []) as SaleRow[]) }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const resolved = await resolveMember(req)
    if ('error' in resolved) return resolved.error
    const turnoId = req.nextUrl.searchParams.get('turno_id')
    if (!turnoId) return NextResponse.json({ ok: false, error: 'missing_shift' }, { status: 400 })

    const { turno, totals } = await getShiftAndSummary(resolved.supabase, resolved.member, turnoId)
    if (!turno || !totals) return NextResponse.json({ ok: false, error: 'shift_not_found' }, { status: 404 })

    const cajaInicial = Number(turno.caja_inicial ?? 0)
    return NextResponse.json({
      ok: true,
      preview: {
        caja_inicial: cajaInicial,
        ventas_efectivo: totals.totalEfectivo,
        total_tarjeta: totals.totalTarjeta,
        total_transferencia: totals.totalTransferencia,
        total_billetera: totals.totalBilletera,
        total_qr: totals.totalQr,
        total_general: totals.totalGeneral,
        transacciones: totals.transacciones,
        efectivo_esperado: cajaInicial + totals.totalEfectivo,
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'unexpected', detail: error instanceof Error ? error.message : 'unexpected' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const resolved = await resolveMember(req)
    if ('error' in resolved) return resolved.error
    const body = await req.json() as { turno_id?: string; efectivo_declarado?: number; observaciones?: string }
    const efectivoDeclarado = Number(body.efectivo_declarado)
    if (!body.turno_id || !Number.isFinite(efectivoDeclarado) || efectivoDeclarado < 0) {
      return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    }

    const { turno, totals } = await getShiftAndSummary(resolved.supabase, resolved.member, body.turno_id)
    if (!turno || !totals) return NextResponse.json({ ok: false, error: 'shift_not_found' }, { status: 404 })
    if (turno.estado !== 'ABIERTO') return NextResponse.json({ ok: false, error: 'shift_already_closed' }, { status: 409 })

    const cajaInicial = Number(turno.caja_inicial ?? 0)
    const efectivoEsperado = cajaInicial + totals.totalEfectivo
    const diferenciaCaja = efectivoDeclarado - efectivoEsperado
    const totalDigital = totals.totalBilletera + totals.totalQr

    const { data: turnoCerrado, error: updateError } = await resolved.supabase
      .from('turnos')
      .update({
        cerrado_at: new Date().toISOString(),
        efectivo_esperado: efectivoEsperado,
        efectivo_declarado: efectivoDeclarado,
        total_efectivo: totals.totalEfectivo,
        total_tarjeta: totals.totalTarjeta,
        total_transferencia: totals.totalTransferencia,
        total_mercado_pago: totalDigital,
        total_general: totals.totalGeneral,
        diferencia_caja: diferenciaCaja,
        observaciones: body.observaciones?.trim() || null,
        metadata: {
          ...(typeof turno.metadata === 'object' && turno.metadata ? turno.metadata : {}),
          total_billetera: totals.totalBilletera,
          total_qr: totals.totalQr,
        },
        estado: 'CERRADO',
      })
      .eq('id', turno.id)
      .eq('estado', 'ABIERTO')
      .select('*')
      .single()

    if (updateError) return NextResponse.json({ ok: false, error: 'db_error', detail: updateError.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      turno: turnoCerrado,
      arqueo: {
        caja_inicial: cajaInicial,
        ventas_efectivo: totals.totalEfectivo,
        total_tarjeta: totals.totalTarjeta,
        total_transferencia: totals.totalTransferencia,
        total_billetera: totals.totalBilletera,
        total_qr: totals.totalQr,
        efectivo_esperado: efectivoEsperado,
        efectivo_declarado: efectivoDeclarado,
        diferencia_caja: diferenciaCaja,
        total_general: totals.totalGeneral,
        transacciones: totals.transacciones,
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'unexpected', detail: error instanceof Error ? error.message : 'unexpected' }, { status: 500 })
  }
}
