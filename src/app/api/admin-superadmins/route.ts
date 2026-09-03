import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  })
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readField(body: unknown, field: string) {
  if (!body || typeof body !== 'object') return undefined
  return (body as Record<string, unknown>)[field]
}

const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'

function makeTempPassword(length = 16) {
  let result = ''
  for (let index = 0; index < length; index += 1) {
    result += TEMP_ALPHABET[randomInt(0, TEMP_ALPHABET.length)]
  }
  return result
}

export async function GET() {
  if (!(await getAdminSession())) return json({ ok: false, error: 'unauthorized' }, 401)

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('super_admin_users')
    .select('id,auth_user_id,email,activo,metadata,created_at')
    .order('created_at', { ascending: true })

  if (error) return json({ ok: false, error: 'db_error' }, 500)

  return json({
    ok: true,
    admins: (data || []).map((row) => ({
      id: row.id,
      email: row.email,
      activo: row.activo,
      nombre: clean(row.metadata?.nombre),
      telefono: clean(row.metadata?.telefono),
      must_change_password: Boolean(row.metadata?.must_change_password),
      created_at: row.created_at,
    })),
  })
}

export async function POST(req: Request) {
  const creator = await getAdminSession()
  if (!creator) return json({ ok: false, error: 'unauthorized' }, 401)

  const body: unknown = await req.json().catch(() => null)
  const nombre = clean(readField(body, 'nombre'))
  const email = clean(readField(body, 'email')).toLowerCase()
  const telefono = clean(readField(body, 'telefono'))
  const tempPassword = makeTempPassword()

  if (nombre.length < 2 || !email.includes('@')) {
    return json({ ok: false, error: 'invalid_input' }, 400)
  }

  const db = getSupabaseAdmin()
  const existing = await db.from('super_admin_users').select('id').eq('email', email).maybeSingle()
  if (existing.data) return json({ ok: false, error: 'already_exists' }, 409)

  const created = await db.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      nombre,
      telefono,
      internal_role: 'SUPERADMIN',
      must_change_password: true,
    },
  })

  if (created.error || !created.data.user?.id) {
    return json(
      { ok: false, error: 'auth_create_failed', detail: created.error?.message },
      500,
    )
  }

  const metadata = {
    nombre,
    telefono,
    must_change_password: true,
    created_by: creator.email || creator.nombre || 'bootstrap',
    created_at: new Date().toISOString(),
  }

  const inserted = await db.from('super_admin_users').insert({
    auth_user_id: created.data.user.id,
    email,
    activo: true,
    sandbox_tenant_id: null,
    metadata,
  })

  if (inserted.error) {
    await db.auth.admin.deleteUser(created.data.user.id)
    return json({ ok: false, error: 'db_insert_failed', detail: inserted.error.message }, 500)
  }

  return json({ ok: true, email, temp_password: tempPassword }, 201)
}
