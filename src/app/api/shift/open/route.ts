import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseAuthVerifier } from '@/lib/supabaseServer'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const verifier = getSupabaseAuthVerifier()
    const { data: userData, error: authError } = await verifier.auth.getUser(token)

    if (authError || !userData.user) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 })
    }

    const body = await req.json() as {
      comercio_usuario_id?: string
      tenant_id?: string
      caja_inicial?: number
    }

    const cajaInicial = Number(body.caja_inicial)
    if (!Number.isFinite(cajaInicial) || cajaInicial < 0) {
      return NextResponse.json({ ok: false, error: 'invalid_initial_cash' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: member, error: memberError } = await supabase
      .from('comercio_usuarios')
      .select('id, tenant_id, rol, activo')
      .eq('auth_user_id', userData.user.id)
      .eq('activo', true)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json({ ok: false, error: 'user_not_linked' }, { status: 403 })
    }

    if (member.rol !== 'EMPLOYEE' && member.rol !== 'OWNER') {
      return NextResponse.json({ ok: false, error: 'role_not_allowed' }, { status: 403 })
    }

    if (body.comercio_usuario_id && body.comercio_usuario_id !== member.id) {
      return NextResponse.json({ ok: false, error: 'user_mismatch' }, { status: 403 })
    }

    if (body.tenant_id && body.tenant_id !== member.tenant_id) {
      return NextResponse.json({ ok: false, error: 'tenant_mismatch' }, { status: 403 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('turnos')
      .select('*')
      .eq('tenant_id', member.tenant_id)
      .eq('comercio_usuario_id', member.id)
      .eq('estado', 'ABIERTO')
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ ok: false, error: 'db_error', detail: existingError.message }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'shift_already_open', mensaje: 'Ya existe un turno abierto para este usuario.', turno: existing },
        { status: 409 }
      )
    }

    const { data: turno, error: insertError } = await supabase
      .from('turnos')
      .insert({
        tenant_id: member.tenant_id,
        comercio_usuario_id: member.id,
        caja_inicial: cajaInicial,
        efectivo_esperado: cajaInicial,
        estado: 'ABIERTO',
      })
      .select('*')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: false, error: 'shift_already_open' }, { status: 409 })
      }
      return NextResponse.json({ ok: false, error: 'db_error', detail: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, turno }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected'
    return NextResponse.json({ ok: false, error: 'unexpected', detail: message }, { status: 500 })
  }
}
