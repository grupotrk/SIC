import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

type CommerceRow = {
  id: string
  tenant_id: string
  nombre: string | null
  email: string | null
  metadata: Record<string, unknown> | null
}

type AuthUserSummary = {
  id: string
  email: string | null
  user_metadata?: Record<string, unknown>
}

type SuperAdminRow = {
  id: string
  auth_user_id: string
  email: string
  sandbox_tenant_id: string
  activo: boolean
}

type CommerceMetadata = Record<string, unknown>

function maybeGetEnv(name: string): string {
  return (process.env[name] || '').trim()
}

function mustGetEnv(name: string): string {
  const value = maybeGetEnv(name)
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function getSuperAdminConfig() {
  return {
    email: normalizeEmail(mustGetEnv('SUPERADMIN_TEST_EMAIL')),
    password: mustGetEnv('SUPERADMIN_TEST_PASSWORD'),
    commerceName: maybeGetEnv('SUPERADMIN_TEST_COMMERCE_NAME') || 'Trikode Laboratorio Interno',
    phone: maybeGetEnv('SUPERADMIN_TEST_PHONE') || '3510000000',
    address: maybeGetEnv('SUPERADMIN_TEST_ADDRESS') || 'Sandbox interno Trikode',
    rubro: maybeGetEnv('SUPERADMIN_TEST_RUBRO') || 'Kioscos',
    plan: maybeGetEnv('SUPERADMIN_TEST_PLAN') || 'Profesional',
  }
}

async function findAuthUserByEmail(supabase: ReturnType<typeof getSupabaseAdmin>, email: string): Promise<AuthUserSummary | null> {
  const normalized = normalizeEmail(email)
  const perPage = 200

  for (let page = 1; page <= 20; page += 1) {
    const listed = await supabase.auth.admin.listUsers({ page, perPage })
    if (listed.error) return null
    const found = (listed.data.users || []).find((user) => normalizeEmail(user.email) === normalized)
    if (found?.id) {
      return {
        id: found.id,
        email: found.email ?? null,
        user_metadata: (found.user_metadata as Record<string, unknown> | undefined) ?? {},
      }
    }
    if ((listed.data.users || []).length < perPage) break
  }

  return null
}

async function resolveRubroId(supabase: ReturnType<typeof getSupabaseAdmin>, rubroName: string): Promise<string> {
  const rubroRes = await supabase.from('rubros').select('id,nombre')
  if (rubroRes.error || !rubroRes.data?.length) throw new Error('missing_rubros')
  return rubroRes.data.find((row) => row.nombre === rubroName)?.id
    ?? rubroRes.data.find((row) => row.nombre === 'Kioscos')?.id
    ?? rubroRes.data[0].id
}

async function resolvePlanId(supabase: ReturnType<typeof getSupabaseAdmin>, planName: string): Promise<string> {
  const planRes = await supabase.from('planes').select('id,nombre,precio').order('precio', { ascending: false })
  if (planRes.error || !planRes.data?.length) throw new Error('missing_planes')
  return planRes.data.find((row) => row.nombre === planName)?.id
    ?? planRes.data.find((row) => row.nombre === 'Profesional')?.id
    ?? planRes.data[0].id
}

async function ensureSandboxCommerce(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  email: string
  commerceName: string
  phone: string
  address: string
  rubro: string
  plan: string
}): Promise<CommerceRow> {
  const existing = await input.supabase
    .from('comercios')
    .select('id,tenant_id,nombre,email,metadata')
    .eq('email', input.email)
    .maybeSingle()

  if (!existing.error && existing.data?.tenant_id) {
    const currentMetadata = existing.data.metadata && typeof existing.data.metadata === 'object'
      ? (existing.data.metadata as CommerceMetadata)
      : {}

    await input.supabase
      .from('comercios')
      .update({
        nombre: input.commerceName,
        telefono: input.phone,
        direccion: input.address,
        metadata: {
          ...currentMetadata,
          super_admin_sandbox: true,
          super_admin_sandbox_updated_at: new Date().toISOString(),
        },
      })
      .eq('tenant_id', existing.data.tenant_id)

    return existing.data as CommerceRow
  }

  const rubroId = await resolveRubroId(input.supabase, input.rubro)
  const planId = await resolvePlanId(input.supabase, input.plan)

  const created = await input.supabase.rpc('registrar_comercio', {
    p_nombre: input.commerceName,
    p_email: input.email,
    p_telefono: input.phone,
    p_direccion: input.address,
    p_rubro_id: rubroId,
    p_plan_id: planId,
  })

  if (created.error || !created.data) throw new Error('sandbox_provision_failed')

  const inserted = await input.supabase
    .from('comercios')
    .select('id,tenant_id,nombre,email,metadata')
    .eq('tenant_id', created.data as string)
    .maybeSingle()

  if (inserted.error || !inserted.data) throw new Error('sandbox_fetch_failed')

  await input.supabase
    .from('comercios')
    .update({
      metadata: {
        ...(inserted.data.metadata && typeof inserted.data.metadata === 'object' ? inserted.data.metadata : {}),
        super_admin_sandbox: true,
        super_admin_sandbox_created_at: new Date().toISOString(),
      },
    })
    .eq('tenant_id', inserted.data.tenant_id)

  return inserted.data as CommerceRow
}

async function ensureAuthUser(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  email: string
  password: string
  tenantId: string
}): Promise<AuthUserSummary> {
  const existing = await findAuthUserByEmail(input.supabase, input.email)

  if (existing?.id) {
    const updated = await input.supabase.auth.admin.updateUserById(existing.id, {
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        tenant_id: input.tenantId,
        internal_role: 'SUPERADMIN',
      },
    })
    if (updated.error || !updated.data.user?.id) throw new Error('superadmin_user_update_failed')
    return {
      id: updated.data.user.id,
      email: updated.data.user.email ?? input.email,
      user_metadata: (updated.data.user.user_metadata as Record<string, unknown> | undefined) ?? {},
    }
  }

  const created = await input.supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      tenant_id: input.tenantId,
      internal_role: 'SUPERADMIN',
    },
  })
  if (created.error || !created.data.user?.id) throw new Error('superadmin_user_create_failed')

  return {
    id: created.data.user.id,
    email: created.data.user.email ?? input.email,
    user_metadata: (created.data.user.user_metadata as Record<string, unknown> | undefined) ?? {},
  }
}

async function ensureSandboxMembership(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  tenantId: string
  authUserId: string
  email: string
}) {
  const existing = await input.supabase
    .from('comercio_usuarios')
    .select('id,tenant_id,auth_user_id')
    .eq('auth_user_id', input.authUserId)
    .maybeSingle()

  if (!existing.error && existing.data?.id) {
    if (existing.data.tenant_id !== input.tenantId) throw new Error('superadmin_bound_to_other_tenant')
    return existing.data
  }

  const existingByEmail = await input.supabase
    .from('comercio_usuarios')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('email', input.email)
    .maybeSingle()

  if (!existingByEmail.error && existingByEmail.data?.id) {
    const updated = await input.supabase
      .from('comercio_usuarios')
      .update({
        auth_user_id: input.authUserId,
        nombre: 'Usuario 0',
        rol: 'OWNER',
        activo: true,
        metadata: {
          source: 'super_admin_sandbox',
          super_admin_access: true,
          updated_at: new Date().toISOString(),
        },
      })
      .eq('id', existingByEmail.data.id)
      .select('id,tenant_id,auth_user_id')
      .maybeSingle()

    if (updated.error || !updated.data) throw new Error('sandbox_membership_update_failed')
    return updated.data
  }

  const inserted = await input.supabase
    .from('comercio_usuarios')
    .insert({
      tenant_id: input.tenantId,
      auth_user_id: input.authUserId,
      nombre: 'Usuario 0',
      email: input.email,
      rol: 'OWNER',
      activo: true,
      metadata: {
        source: 'super_admin_sandbox',
        super_admin_access: true,
        created_at: new Date().toISOString(),
      },
    })
    .select('id,tenant_id,auth_user_id')
    .maybeSingle()

  if (inserted.error || !inserted.data) throw new Error('sandbox_membership_insert_failed')
  return inserted.data
}

async function ensureSuperAdminRecord(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  authUserId: string
  email: string
  sandboxTenantId: string
}) {
  const existing = await input.supabase
    .from('super_admin_users')
    .select('id,auth_user_id,email,sandbox_tenant_id,activo')
    .eq('auth_user_id', input.authUserId)
    .maybeSingle()

  if (!existing.error && existing.data?.id) {
    const updated = await input.supabase
      .from('super_admin_users')
      .update({
        email: input.email,
        sandbox_tenant_id: input.sandboxTenantId,
        activo: true,
        metadata: {
          source: 'admin_provision',
          updated_at: new Date().toISOString(),
        },
      })
      .eq('id', existing.data.id)
      .select('id,auth_user_id,email,sandbox_tenant_id,activo')
      .maybeSingle()

    if (updated.error || !updated.data) throw new Error('superadmin_update_failed')
    return updated.data as SuperAdminRow
  }

  const inserted = await input.supabase
    .from('super_admin_users')
    .insert({
      auth_user_id: input.authUserId,
      email: input.email,
      sandbox_tenant_id: input.sandboxTenantId,
      activo: true,
      metadata: {
        source: 'admin_provision',
        created_at: new Date().toISOString(),
      },
    })
    .select('id,auth_user_id,email,sandbox_tenant_id,activo')
    .maybeSingle()

  if (inserted.error || !inserted.data) throw new Error('superadmin_insert_failed')
  return inserted.data as SuperAdminRow
}

export async function POST() {
  try {
    if (!(await hasValidAdminSession())) {
      return jsonNoStore({ ok: false, error: 'unauthorized' }, 401)
    }

    mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
    mustGetEnv('SUPABASE_SERVICE_ROLE_KEY')

    const config = getSuperAdminConfig()
    const supabase = getSupabaseAdmin()

    const commerce = await ensureSandboxCommerce({
      supabase,
      email: config.email,
      commerceName: config.commerceName,
      phone: config.phone,
      address: config.address,
      rubro: config.rubro,
      plan: config.plan,
    })

    const authUser = await ensureAuthUser({
      supabase,
      email: config.email,
      password: config.password,
      tenantId: commerce.tenant_id,
    })

    await ensureSandboxMembership({
      supabase,
      tenantId: commerce.tenant_id,
      authUserId: authUser.id,
      email: config.email,
    })

    const superAdmin = await ensureSuperAdminRecord({
      supabase,
      authUserId: authUser.id,
      email: config.email,
      sandboxTenantId: commerce.tenant_id,
    })

    return jsonNoStore({
      ok: true,
      email: superAdmin.email,
      sandbox_tenant_id: superAdmin.sandbox_tenant_id,
      role: 'SUPERADMIN',
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }
    return jsonNoStore({ ok: false, error: 'unexpected' }, 500)
  }
}