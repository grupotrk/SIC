import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

type LoginRole = 'OWNER' | 'EMPLOYEE'

type ComercioUsuarioRow = {
  email: string | null
  nombre: string | null
  rol: LoginRole
  activo: boolean
  metadata: Record<string, unknown> | null
}

const OWNER_USERNAME_REGEX = /^[a-zA-Z0-9]{4,40}$/
const EMPLOYEE_USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase()
}

function parseRole(value: unknown): LoginRole | null {
  return value === 'OWNER' || value === 'EMPLOYEE' ? value : null
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as null | {
      role?: unknown
      identifier?: unknown
    }

    const role = parseRole(body?.role)
    const identifierRaw = typeof body?.identifier === 'string' ? body.identifier : ''
    const identifier = normalizeIdentifier(identifierRaw)

    if (!role || !identifier) {
      return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    }

    if (role === 'OWNER') {
      if (!OWNER_USERNAME_REGEX.test(identifier) && !EMAIL_REGEX.test(identifier)) {
        return NextResponse.json({ ok: false, error: 'invalid_owner_identifier' }, { status: 400 })
      }
    } else {
      if (!EMPLOYEE_USERNAME_REGEX.test(identifier)) {
        return NextResponse.json({ ok: false, error: 'invalid_employee_identifier' }, { status: 400 })
      }
    }

    const supabase = getSupabaseAdmin()

    // Las cuentas internas SUPERADMIN nunca deben resolverse como credenciales
    // operativas OWNER/EMPLOYEE. Esto corta el acceso antes de autenticar.
    if (EMAIL_REGEX.test(identifier)) {
      const superAdminRes = await supabase
        .from('super_admin_users')
        .select('id,activo')
        .ilike('email', identifier)
        .maybeSingle()

      if (superAdminRes.error) {
        return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
      }

      if (superAdminRes.data?.activo) {
        return NextResponse.json({ ok: false, error: 'superadmin_account' }, { status: 403 })
      }
    }

    if (role === 'OWNER' && EMAIL_REGEX.test(identifier)) {
      return NextResponse.json({ ok: true, email: identifier }, { status: 200 })
    }
    const byUsernameRes = await supabase
      .from('comercio_usuarios')
      .select('email,nombre,rol,activo,metadata')
      .eq('rol', role)
      .eq('activo', true)
      .eq('metadata->>login_username', identifier)

    if (byUsernameRes.error) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const candidates = (byUsernameRes.data || []) as ComercioUsuarioRow[]

    if (candidates.length === 0) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }

    if (candidates.length > 1) {
      return NextResponse.json({ ok: false, error: 'ambiguous_user' }, { status: 409 })
    }

    const email = String(candidates[0].email || '').trim().toLowerCase()
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ ok: false, error: 'email_not_configured' }, { status: 409 })
    }

    return NextResponse.json({ ok: true, email }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
