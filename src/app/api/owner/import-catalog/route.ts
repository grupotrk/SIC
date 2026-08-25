import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { findCatalogoByRubro } from '@/lib/catalogoTemplates'

async function resolveOwnerTenant(token: string): Promise<{ tenantId: string; rubroNombre: string | null } | null> {
  const supabase = getSupabaseAdmin()
  const { data: userData, error } = await supabase.auth.getUser(token)
  if (error || !userData.user) return null

  const { data: owner } = await supabase
    .from('comercio_usuarios')
    .select('tenant_id')
    .eq('auth_user_id', userData.user.id)
    .eq('rol', 'OWNER')
    .eq('activo', true)
    .single()

  if (!owner?.tenant_id) return null

  const { data: comercio } = await supabase
    .from('comercios')
    .select('rubros(nombre)')
    .eq('tenant_id', owner.tenant_id)
    .maybeSingle()

  const rubro = (comercio?.rubros as unknown as { nombre: string } | null)
  return { tenantId: owner.tenant_id, rubroNombre: rubro?.nombre ?? null }
}

// GET /api/owner/import-catalog
// Devuelve la vista previa del catálogo base para el rubro del tenant.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('authorization')?.substring(7)
    if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

    const info = await resolveOwnerTenant(token)
    if (!info) return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })

    if (!info.rubroNombre) {
      return NextResponse.json({ success: false, error: 'sin_rubro', mensaje: 'Tu comercio no tiene rubro asignado.' }, { status: 422 })
    }

    const catalogo = findCatalogoByRubro(info.rubroNombre)
    if (!catalogo) {
      return NextResponse.json({
        success: false,
        error: 'rubro_sin_catalogo',
        rubro: info.rubroNombre,
        mensaje: `No tenemos un catálogo base para el rubro "${info.rubroNombre}" todavía.`,
      }, { status: 422 })
    }

    // Verificar si el tenant ya tiene productos
    const supabase = getSupabaseAdmin()
    const { count } = await supabase
      .from('productos_tienda')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', info.tenantId)

    return NextResponse.json({
      success: true,
      rubro: info.rubroNombre,
      catalogoNombre: catalogo.rubroNombre,
      totalProductos: catalogo.productos.length,
      yaConProductos: (count ?? 0) > 0,
      productosExistentes: count ?? 0,
      productos: catalogo.productos,
    })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}

// POST /api/owner/import-catalog
// Importa el catálogo base al tenant. Si ya tiene productos, usa ?forzar=true para agregar igualmente.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('authorization')?.substring(7)
    if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

    const info = await resolveOwnerTenant(token)
    if (!info) return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })

    if (!info.rubroNombre) {
      return NextResponse.json({ success: false, error: 'sin_rubro' }, { status: 422 })
    }

    const catalogo = findCatalogoByRubro(info.rubroNombre)
    if (!catalogo) {
      return NextResponse.json({ success: false, error: 'rubro_sin_catalogo' }, { status: 422 })
    }

    const forzar = req.nextUrl.searchParams.get('forzar') === 'true'
    const supabase = getSupabaseAdmin()

    if (!forzar) {
      const { count } = await supabase
        .from('productos_tienda')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', info.tenantId)

      if ((count ?? 0) > 0) {
        return NextResponse.json({
          success: false,
          error: 'ya_tiene_productos',
          mensaje: `Tu catálogo ya tiene ${count} productos. Usá ?forzar=true si querés agregar igual.`,
        }, { status: 409 })
      }
    }

    const rows = catalogo.productos.map((item) => ({
      tenant_id:        info.tenantId,
      nombre:           item.nombre,
      marca:            '',
      categoria:        item.categoria,
      unidad_medida:    item.unidad_medida,
      precio_venta:     item.precio_venta,
      precio_costo:     item.precio_costo,
      stock_actual:     0,
      stock_minimo:     0,
      permite_fraccion: item.permite_fraccion,
      activo:           true,
    }))

    const { error } = await supabase.from('productos_tienda').insert(rows)
    if (error) return NextResponse.json({ success: false, error: 'db_error', detalle: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      insertados: rows.length,
      mensaje: `Se importaron ${rows.length} productos del catálogo base de ${catalogo.rubroNombre}.`,
    })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}
