import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

// POST /api/employee/add-stock
// Body: { productoId: string, cantidad: number }
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseAdmin()

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
    }

    // Verificar que sea EMPLOYEE activo con permiso puede_agregar_stock
    const { data: empData, error: empError } = await supabase
      .from('comercio_usuarios')
      .select('id, tenant_id, metadata')
      .eq('auth_user_id', userData.user.id)
      .eq('rol', 'EMPLOYEE')
      .eq('activo', true)
      .single()

    if (empError || !empData) {
      return NextResponse.json({ success: false, error: 'not_employee' }, { status: 403 })
    }

    const meta = empData.metadata as Record<string, unknown> | null
    if (!meta?.puede_agregar_stock) {
      return NextResponse.json({ success: false, error: 'no_permission' }, { status: 403 })
    }

    const body = await req.json()
    const { productoId, cantidad } = body

    if (!productoId || !cantidad || isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
      return NextResponse.json({ success: false, error: 'invalid_input' }, { status: 400 })
    }

    // Verificar que el producto pertenece al tenant del employee
    const { data: producto, error: prodError } = await supabase
      .from('productos_tienda')
      .select('id, nombre, stock_actual')
      .eq('id', productoId)
      .eq('tenant_id', empData.tenant_id)
      .eq('activo', true)
      .single()

    if (prodError || !producto) {
      return NextResponse.json({ success: false, error: 'product_not_found' }, { status: 404 })
    }

    const nuevoStock = Number(producto.stock_actual) + Number(cantidad)

    const { error: updateError } = await supabase
      .from('productos_tienda')
      .update({ stock_actual: nuevoStock })
      .eq('id', productoId)
      .eq('tenant_id', empData.tenant_id)

    if (updateError) {
      return NextResponse.json({ success: false, error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      nuevoStock,
      mensaje: `Stock de "${producto.nombre}" actualizado a ${nuevoStock}`,
    })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}
