import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseAuthVerifier } from '@/lib/supabaseServer'

type ImportRow = {
  nombre?: string
  marca?: string
  categoria?: string
  unidad_medida?: string
  precio_venta?: number
  precio_costo?: number | null
  stock_actual?: number
  stock_minimo?: number
  permite_fraccion?: boolean
  codigo_barras?: string | null
  observaciones?: string | null
}

function keyFor(row: { nombre?: string | null; marca?: string | null }): string {
  return `${row.nombre ?? ''}::${row.marca ?? ''}`.trim().toLocaleLowerCase('es')
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

    const token = authHeader.slice(7)
    const verifier = getSupabaseAuthVerifier()
    const { data: authData, error: authError } = await verifier.auth.getUser(token)
    if (authError || !authData.user) return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: owner } = await supabase
      .from('comercio_usuarios')
      .select('tenant_id')
      .eq('auth_user_id', authData.user.id)
      .eq('rol', 'OWNER')
      .eq('activo', true)
      .maybeSingle()
    if (!owner?.tenant_id) return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })

    const body = await req.json() as { rows?: ImportRow[] }
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2500) : []
    if (!rows.length) return NextResponse.json({ success: false, error: 'empty_import' }, { status: 400 })

    const cleanRows = rows.filter((row) => {
      const price = Number(row.precio_venta)
      return Boolean(row.nombre?.trim()) && Number.isFinite(price) && price >= 0
    })

    const { data: existing, error: existingError } = await supabase
      .from('productos_tienda')
      .select('id,nombre,marca,codigo_barras')
      .eq('tenant_id', owner.tenant_id)
    if (existingError) return NextResponse.json({ success: false, error: existingError.message }, { status: 500 })

    const byBarcode = new Map<string, string>()
    const byName = new Map<string, string>()
    for (const product of existing ?? []) {
      const barcode = String(product.codigo_barras ?? '').trim()
      if (barcode) byBarcode.set(barcode, product.id)
      byName.set(keyFor(product), product.id)
    }

    const inserts: Record<string, unknown>[] = []
    const updates: Array<{ id: string; data: Record<string, unknown> }> = []
    let skipped = rows.length - cleanRows.length

    for (const row of cleanRows) {
      const barcode = String(row.codigo_barras ?? '').trim()
      const payload = {
        tenant_id: owner.tenant_id,
        nombre: row.nombre!.trim(),
        marca: row.marca?.trim() ?? '',
        categoria: row.categoria?.trim() || 'General',
        unidad_medida: row.unidad_medida?.trim() || 'unidad',
        precio_venta: Number(row.precio_venta ?? 0),
        precio_costo: row.precio_costo == null ? null : Number(row.precio_costo),
        stock_actual: Math.max(0, Number(row.stock_actual ?? 0)),
        stock_minimo: Math.max(0, Number(row.stock_minimo ?? 0)),
        permite_fraccion: Boolean(row.permite_fraccion),
        codigo_barras: barcode || null,
        observaciones: row.observaciones?.trim() || null,
        activo: true,
      }
      const existingId = (barcode && byBarcode.get(barcode)) || byName.get(keyFor(row))
      if (existingId) updates.push({ id: existingId, data: payload })
      else inserts.push(payload)
    }

    if (inserts.length) {
      const { error } = await supabase.from('productos_tienda').insert(inserts)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    let updated = 0
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50)
      const results = await Promise.all(batch.map(({ id, data }) => supabase.from('productos_tienda').update(data).eq('id', id).eq('tenant_id', owner.tenant_id)))
      const firstError = results.find((result) => result.error)?.error
      if (firstError) return NextResponse.json({ success: false, error: firstError.message }, { status: 500 })
      updated += batch.length
    }

    return NextResponse.json({ success: true, inserted: inserts.length, updated, skipped })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'unexpected' }, { status: 500 })
  }
}
