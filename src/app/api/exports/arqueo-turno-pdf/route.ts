import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

async function buildArqueoPdf(selectedDate: string, payload: {
  turnoId: string
  ventasCompletadas: number
  totalVendido: number
  totalEfectivo: number
  totalTarjeta: number
  totalTransferencia: number
  totalMercadoPago: number
}) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawText('Trikode SIC - Arqueo de Turno Personal', {
    x: 40,
    y: 800,
    size: 18,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  })

  page.drawText(`Fecha operativa: ${selectedDate}`, { x: 40, y: 775, size: 11, font })
  page.drawText(`Turno ID: ${payload.turnoId}`, { x: 40, y: 755, size: 11, font })

  const rows = [
    ['Ventas completadas', String(payload.ventasCompletadas)],
    ['Total vendido', `$${payload.totalVendido.toFixed(2)}`],
    ['Total efectivo', `$${payload.totalEfectivo.toFixed(2)}`],
    ['Total tarjeta', `$${payload.totalTarjeta.toFixed(2)}`],
    ['Total transferencia', `$${payload.totalTransferencia.toFixed(2)}`],
    ['Total mercado pago', `$${payload.totalMercadoPago.toFixed(2)}`],
  ]

  let y = 715
  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y, size: 11, font: bold })
    page.drawText(value, { x: 240, y, size: 11, font })
    y -= 26
  }

  page.drawText('Generado por Trikode SIC', { x: 40, y: 60, size: 9, font, color: rgb(0.4, 0.4, 0.4) })

  return await pdf.save()
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

    const tenantId = (user.user_metadata?.tenant_id as string | undefined) || user.id

    const superAdminRes = await supabase
      .from('super_admin_users')
      .select('activo')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const isSuperAdmin = !superAdminRes.error && Boolean(superAdminRes.data?.activo)

    const { data: comercioUsuario, error: roleError } = await supabase
      .from('comercio_usuarios')
      .select('id,rol,activo')
      .eq('auth_user_id', user.id)
      .eq('tenant_id', tenantId)
      .single()

    if (
      roleError ||
      !comercioUsuario ||
      !comercioUsuario.activo ||
      (comercioUsuario.rol !== 'EMPLOYEE' && !isSuperAdmin)
    ) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().slice(0, 10)

    const { data: turno, error: turnoError } = await supabase
      .from('turnos')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('comercio_usuario_id', comercioUsuario.id)
      .eq('fecha_operativa', selectedDate)
      .order('abierto_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (turnoError || !turno) {
      return NextResponse.json({ ok: false, error: 'no_shift_for_date' }, { status: 404 })
    }

    const { data: ventas, error: ventasError } = await supabase
      .from('ventas')
      .select('estado,metodo_pago,total')
      .eq('tenant_id', tenantId)
      .eq('comercio_usuario_id', comercioUsuario.id)
      .eq('turno_id', turno.id)

    if (ventasError) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const summary = (ventas || []).reduce(
      (acc, v) => {
        if (v.estado !== 'COMPLETADA') return acc
        const total = Number(v.total || 0)
        acc.ventasCompletadas += 1
        acc.totalVendido += total
        if (v.metodo_pago === 'EFECTIVO') acc.totalEfectivo += total
        if (v.metodo_pago === 'TARJETA') acc.totalTarjeta += total
        if (v.metodo_pago === 'TRANSFERENCIA') acc.totalTransferencia += total
        if (v.metodo_pago === 'MERCADO_PAGO') acc.totalMercadoPago += total
        return acc
      },
      {
        ventasCompletadas: 0,
        totalVendido: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalMercadoPago: 0,
      }
    )

    const bytes = await buildArqueoPdf(selectedDate, {
      turnoId: turno.id,
      ...summary,
    })
    const pdfBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="arqueo-turno-${selectedDate}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
