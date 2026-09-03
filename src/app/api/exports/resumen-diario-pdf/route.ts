import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

async function buildResumenPdf(selectedDate: string, resumen: Record<string, unknown>) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawText('SIDEA SIC - Resumen Diario', { x: 40, y: 800, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1) })
  page.drawText(`Fecha operativa: ${selectedDate}`, { x: 40, y: 775, size: 11, font })

  const rows = [
    ['Total ventas', String(resumen.total_ventas ?? 0)],
    ['Total anuladas', String(resumen.total_anuladas ?? 0)],
    ['Total devoluciones', String(resumen.total_devoluciones ?? 0)],
    ['Total general', `$${resumen.total_general ?? 0}`],
    ['Total efectivo', `$${resumen.total_efectivo ?? 0}`],
    ['Total tarjeta', `$${resumen.total_tarjeta ?? 0}`],
    ['Total transferencia', `$${resumen.total_transferencia ?? 0}`],
    ['Total billetera / QR', `$${resumen.total_mercado_pago ?? 0}`],
  ]

  let y = 730
  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y, size: 11, font: bold })
    page.drawText(value, { x: 240, y, size: 11, font })
    y -= 26
  }

  page.drawText('Generado por SIDEA SIC', { x: 40, y: 60, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
  return await pdf.save()
}

export async function GET(req: Request) {
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 })

    const { data: comercioUsuario, error: roleError } = await supabase
      .from('comercio_usuarios')
      .select('tenant_id,rol,activo')
      .eq('auth_user_id', user.id)
      .eq('activo', true)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admin_users')
      .select('activo')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const isSuperAdmin = Boolean(superAdmin?.activo)
    if ((roleError || !comercioUsuario) && !isSuperAdmin) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }
    if (comercioUsuario && comercioUsuario.rol !== 'OWNER' && !isSuperAdmin) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const fallbackTenant = user.user_metadata?.tenant_id as string | undefined
    const tenantId = comercioUsuario?.tenant_id || fallbackTenant
    if (!tenantId) return NextResponse.json({ ok: false, error: 'tenant_not_found' }, { status: 403 })

    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())

    const { data: resumen, error: resumenError } = await supabase
      .from('resumen_cierre_diario')
      .select('fecha_operativa,total_ventas,total_anuladas,total_devoluciones,total_general,total_efectivo,total_tarjeta,total_transferencia,total_mercado_pago')
      .eq('tenant_id', tenantId)
      .eq('fecha_operativa', selectedDate)
      .maybeSingle()

    if (resumenError) {
      console.error('Error consultando resumen_cierre_diario:', resumenError)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    if (!resumen) return NextResponse.json({ ok: false, error: 'no_data_for_date' }, { status: 404 })

    const bytes = await buildResumenPdf(selectedDate, resumen as Record<string, unknown>)
    const pdfBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="resumen-diario-${selectedDate}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando resumen diario PDF:', error)
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
