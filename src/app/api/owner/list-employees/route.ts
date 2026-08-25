import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export async function GET(req: NextRequest): Promise<NextResponse> {
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

    // Verificar que sea OWNER activo
    const { data: ownerData, error: ownerError } = await supabase
      .from('comercio_usuarios')
      .select('tenant_id')
      .eq('auth_user_id', userData.user.id)
      .eq('rol', 'OWNER')
      .eq('activo', true)
      .single()

    if (ownerError || !ownerData) {
      return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })
    }

    const { data: employees, error: empError } = await supabase
      .from('comercio_usuarios')
      .select('id,nombre,email,activo,metadata')
      .eq('tenant_id', ownerData.tenant_id)
      .eq('rol', 'EMPLOYEE')
      .order('nombre', { ascending: true })

    if (empError) {
      return NextResponse.json({ success: false, error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, employees: employees ?? [] })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
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

    const { data: ownerData, error: ownerError } = await supabase
      .from('comercio_usuarios')
      .select('tenant_id')
      .eq('auth_user_id', userData.user.id)
      .eq('rol', 'OWNER')
      .eq('activo', true)
      .single()

    if (ownerError || !ownerData) {
      return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })
    }

    const empleadoId = new URL(req.url).searchParams.get('id')
    if (!empleadoId) {
      return NextResponse.json({ success: false, error: 'missing_id' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('comercio_usuarios')
      .update({ activo: false })
      .eq('id', empleadoId)
      .eq('tenant_id', ownerData.tenant_id)
      .eq('rol', 'EMPLOYEE')

    if (updateError) {
      return NextResponse.json({ success: false, error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
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

    const { data: ownerData, error: ownerError } = await supabase
      .from('comercio_usuarios')
      .select('tenant_id')
      .eq('auth_user_id', userData.user.id)
      .eq('rol', 'OWNER')
      .eq('activo', true)
      .single()

    if (ownerError || !ownerData) {
      return NextResponse.json({ success: false, error: 'not_owner' }, { status: 403 })
    }

    const url = new URL(req.url)
    const empleadoId = url.searchParams.get('id')
    const permiso = url.searchParams.get('permiso')
    const valor = url.searchParams.get('valor')

    if (!empleadoId || !permiso) {
      return NextResponse.json({ success: false, error: 'missing_params' }, { status: 400 })
    }

    // Obtener metadata actual
    const { data: empData, error: empError } = await supabase
      .from('comercio_usuarios')
      .select('metadata')
      .eq('id', empleadoId)
      .eq('tenant_id', ownerData.tenant_id)
      .eq('rol', 'EMPLOYEE')
      .single()

    if (empError || !empData) {
      return NextResponse.json({ success: false, error: 'employee_not_found' }, { status: 404 })
    }

    const newMetadata = { ...(empData.metadata as Record<string, unknown> ?? {}), [permiso]: valor === 'true' }

    const { error: updateError } = await supabase
      .from('comercio_usuarios')
      .update({ metadata: newMetadata })
      .eq('id', empleadoId)
      .eq('tenant_id', ownerData.tenant_id)

    if (updateError) {
      return NextResponse.json({ success: false, error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'internal_error' }, { status: 500 })
  }
}
