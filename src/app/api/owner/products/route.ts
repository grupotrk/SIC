import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { SupabaseClient } from '@supabase/supabase-js'

async function resolveOwnerTenant(supabase: SupabaseClient, token: string): Promise<string | null> {
  const { data: userData, error } = await supabase.auth.getUser(token)
  if (error || !userData.user) return null
  const { data: owner } = await supabase
    .from('comercio_usuarios')
    .select('tenant_id')
    .eq('auth_user_id', userData.user.id)
    .eq('rol', 'OWNER')
    .eq('activo', true)
    .single()
  return owner?.tenant_id ?? null
}

// GET /api/owner/products — listar productos del tenant
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('authorization')?.substring(7)
    if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const tenantId = await resolveOwnerTenant(supabase, token)
    if (!tenantId) return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })

    const { data, error } = await supabase
      .from('productos_tienda')
      .select('id,nombre,marca,categoria,unidad_medida,precio_costo,precio_venta,stock_actual,stock_minimo,permite_fraccion,activo,codigo_barras,observaciones')
      .eq('tenant_id', tenantId)
      .order('nombre', { ascending: true })

    if (error) return NextResponse.json({ success: false, error: 'db_error' }, { status: 500 })
    return NextResponse.json({ success: true, products: data ?? [] })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}

// POST /api/owner/products — crear producto
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('authorization')?.substring(7)
    if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const tenantId = await resolveOwnerTenant(supabase, token)
    if (!tenantId) return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })

    const body = await req.json()
    const { nombre, marca, categoria, unidad_medida, precio_venta, precio_costo, stock_actual, stock_minimo, permite_fraccion, codigo_barras, observaciones } = body

    if (!nombre?.trim() || !precio_venta) {
      return NextResponse.json({ success: false, error: 'missing_fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('productos_tienda')
      .insert({
        tenant_id: tenantId,
        nombre: nombre.trim(),
        marca: marca?.trim() || '',
        categoria: categoria?.trim() || 'General',
        unidad_medida: unidad_medida?.trim() || 'unidad',
        precio_venta: parseFloat(precio_venta),
        precio_costo: precio_costo ? parseFloat(precio_costo) : null,
        stock_actual: stock_actual ? parseFloat(stock_actual) : 0,
        stock_minimo: stock_minimo ? parseFloat(stock_minimo) : 0,
        permite_fraccion: Boolean(permite_fraccion),
        codigo_barras: codigo_barras?.trim() || null,
        observaciones: observaciones?.trim() || null,
        activo: true,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, id: data.id })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}

// PATCH /api/owner/products — editar producto
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('authorization')?.substring(7)
    if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const tenantId = await resolveOwnerTenant(supabase, token)
    if (!tenantId) return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })

    const body = await req.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ success: false, error: 'missing_id' }, { status: 400 })

    const allowed = ['nombre','marca','categoria','unidad_medida','precio_venta','precio_costo','stock_actual','stock_minimo','permite_fraccion','codigo_barras','observaciones','activo']
    const update: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key]
    }

    const { error } = await supabase
      .from('productos_tienda')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}

// DELETE /api/owner/products?id=xxx — desactivar producto
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('authorization')?.substring(7)
    if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const tenantId = await resolveOwnerTenant(supabase, token)
    if (!tenantId) return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'missing_id' }, { status: 400 })

    const { error } = await supabase
      .from('productos_tienda')
      .update({ activo: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}

