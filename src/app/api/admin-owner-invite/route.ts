import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

type LeadRow = {
  id: string
  nombre_comercio: string | null
  email: string | null
  estado: string | null
}

type CommerceRow = {
  tenant_id: string
  metadata: Record<string, unknown> | null
}

type OwnerRow = {
  id: string
  tenant_id: string
  auth_user_id: string
  rol: 'OWNER'
}

type CommerceMetadata = Record<string, unknown>

function mustGetEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
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

function displayOwnerName(lead: LeadRow): string {
  const raw = (lead.nombre_comercio || '').trim()
  if (!raw) return 'Owner'
  return raw.slice(0, 100)
}

function buildOwnerLoginUsername(lead: LeadRow, tenantId: string): string {
  const base = (lead.nombre_comercio || 'owner')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) || 'owner'
  const suffix = tenantId.replace(/-/g, '').slice(0, 6)
  return `${base}${suffix}`
}

async function roleLoginUsernameExists(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  role: 'OWNER' | 'EMPLOYEE',
  loginUsername: string
): Promise<boolean> {
  const normalized = loginUsername.trim().toLowerCase()
  if (!normalized) return false

  const { data, error } = await supabase
    .from('comercio_usuarios')
    .select('id')
    .eq('rol', role)
    .eq('activo', true)
    .eq('metadata->>login_username', normalized)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error('owner_username_check_failed')
  }

  return Boolean(data?.id)
}

async function resolveUniqueRoleLoginUsername(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  role: 'OWNER' | 'EMPLOYEE',
  desired: string
): Promise<string> {
  const normalized = desired.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40) || (role === 'OWNER' ? 'owner' : 'empleado')
  if (!(await roleLoginUsernameExists(supabase, role, normalized))) {
    return normalized
  }

  const base = normalized.slice(0, 34)
  for (let i = 2; i <= 99; i += 1) {
    const candidate = `${base}${i}`.slice(0, 40)
    if (!(await roleLoginUsernameExists(supabase, role, candidate))) {
      return candidate
    }
  }

  throw new Error('owner_username_exhausted')
}

function resolveInviteRedirectUrl(): string | undefined {
  const direct = (process.env.OWNER_INVITE_REDIRECT_URL || '').trim()
  if (direct) return direct

  const fromPaymentSuccess = (process.env.PAYMENT_SUCCESS_URL || '').trim()
  if (!fromPaymentSuccess) return undefined

  try {
    const url = new URL(fromPaymentSuccess)
    url.pathname = '/set-password'
    url.search = ''
    return url.toString()
  } catch {
    return undefined
  }
}

async function findAuthUserIdByEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  email: string
): Promise<string | null> {
  const normalized = normalizeEmail(email)
  const perPage = 200

  for (let page = 1; page <= 20; page += 1) {
    const listed = await supabase.auth.admin.listUsers({ page, perPage })
    if (listed.error) return null

    const users = listed.data.users || []
    const found = users.find((user) => normalizeEmail(user.email) === normalized)
    if (found?.id) return found.id
    if (users.length < perPage) break
  }

  return null
}

async function findCommerceForLead(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  lead: LeadRow
): Promise<CommerceRow | null> {
  const byLeadId = await supabase
    .from('comercios')
    .select('tenant_id,metadata')
    .contains('metadata', { lead_id: lead.id })
    .limit(1)
    .maybeSingle()

  if (!byLeadId.error && byLeadId.data) {
    return byLeadId.data as CommerceRow
  }

  const email = normalizeEmail(lead.email)
  if (!email) return null

  const byEmail = await supabase
    .from('comercios')
    .select('tenant_id,metadata')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (byEmail.error || !byEmail.data) return null
  return byEmail.data as CommerceRow
}

async function syncCommerceOnboardingMetadata(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  commerce: CommerceRow
  lead: LeadRow
  authUserId: string | null
  invitationSent: boolean
}) {
  const currentMetadata =
    input.commerce.metadata && typeof input.commerce.metadata === 'object'
      ? (input.commerce.metadata as CommerceMetadata)
      : {}

  const nextMetadata: CommerceMetadata = {
    ...currentMetadata,
    lead_id: input.lead.id,
    lead_email: normalizeEmail(input.lead.email) || null,
    owner_email: normalizeEmail(input.lead.email) || null,
    owner_auth_user_id: input.authUserId,
    owner_invitation_sent: input.invitationSent,
    owner_activation_status: input.authUserId ? 'LISTO' : 'PENDIENTE_INVITACION',
    owner_activation_updated_at: new Date().toISOString(),
  }

  const updateRes = await input.supabase
    .from('comercios')
    .update({ metadata: nextMetadata })
    .eq('tenant_id', input.commerce.tenant_id)

  if (updateRes.error) {
    throw new Error('commerce_metadata_update_failed')
  }
}

async function ensureOwnerMembership(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  lead: LeadRow
  commerce: CommerceRow
  authUserId: string
}) {
  const existing = await input.supabase
    .from('comercio_usuarios')
    .select('id,tenant_id,auth_user_id,rol')
    .eq('tenant_id', input.commerce.tenant_id)
    .eq('rol', 'OWNER')
    .eq('activo', true)
    .maybeSingle()

  if (!existing.error && existing.data?.auth_user_id) {
    return existing.data as OwnerRow
  }

  const insertRes = await input.supabase.from('comercio_usuarios').insert({
    tenant_id: input.commerce.tenant_id,
    auth_user_id: input.authUserId,
    nombre: displayOwnerName(input.lead),
    email: normalizeEmail(input.lead.email),
    rol: 'OWNER',
    activo: true,
    metadata: {
      source: 'admin_owner_reinvite',
      lead_id: input.lead.id,
      login_username: await resolveUniqueRoleLoginUsername(
        input.supabase,
        'OWNER',
        buildOwnerLoginUsername(input.lead, input.commerce.tenant_id)
      ),
    },
  })

  if (insertRes.error && insertRes.error.code !== '23505') {
    throw new Error('owner_link_failed')
  }

  const resolved = await input.supabase
    .from('comercio_usuarios')
    .select('id,tenant_id,auth_user_id,rol')
    .eq('tenant_id', input.commerce.tenant_id)
    .eq('rol', 'OWNER')
    .eq('activo', true)
    .maybeSingle()

  if (resolved.error || !resolved.data?.auth_user_id) {
    throw new Error('owner_link_failed')
  }

  return resolved.data as OwnerRow
}

async function logOwnerInviteAttempt(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  leadId: string
  ownerEmail: string
  sent: boolean
  result: string
  errorMessage?: string
}) {
  const insertRes = await input.supabase.from('notificacion_logs').insert({
    lead_id: input.leadId,
    tipo: 'EMAIL',
    motivo: 'OWNER_ACTIVACION',
    mensaje: `OWNER ${input.sent ? 'activado/reenviado' : 'pendiente'} · ${input.result} · ${input.ownerEmail}`,
    enviado: input.sent,
    error_message: input.errorMessage ?? null,
    enviado_at: input.sent ? new Date().toISOString() : null,
  })

  if (insertRes.error) {
    throw new Error('owner_invite_log_failed')
  }
}

export async function POST(req: Request) {
  try {
    if (!(await hasValidAdminSession())) {
      return jsonNoStore({ ok: false, error: 'unauthorized' }, 401)
    }

    mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
    mustGetEnv('SUPABASE_SERVICE_ROLE_KEY')

    const body = (await req.json().catch(() => null)) as null | Record<string, unknown>
    const leadId = typeof body?.leadId === 'string' ? body.leadId.trim() : ''
    if (!leadId) {
      return jsonNoStore({ ok: false, error: 'missing_lead_id' }, 400)
    }

    const supabase = getSupabaseAdmin()
    const leadRes = await supabase
      .from('leads')
      .select('id,nombre_comercio,email,estado')
      .eq('id', leadId)
      .maybeSingle()

    if (leadRes.error || !leadRes.data) {
      return jsonNoStore({ ok: false, error: 'lead_not_found' }, 404)
    }

    const lead = leadRes.data as LeadRow
    if (String(lead.estado || '').trim().toUpperCase() !== 'PAGADO') {
      return jsonNoStore({ ok: false, error: 'lead_not_paid' }, 409)
    }

    const ownerEmail = normalizeEmail(lead.email)
    if (!ownerEmail) {
      return jsonNoStore({ ok: false, error: 'owner_email_missing' }, 400)
    }

    const commerce = await findCommerceForLead(supabase, lead)
    if (!commerce) {
      return jsonNoStore({ ok: false, error: 'commerce_not_found' }, 404)
    }

    const existingOwner = await supabase
      .from('comercio_usuarios')
      .select('id,tenant_id,auth_user_id,rol')
      .eq('tenant_id', commerce.tenant_id)
      .eq('rol', 'OWNER')
      .eq('activo', true)
      .maybeSingle()

    if (!existingOwner.error && existingOwner.data?.auth_user_id) {
      await syncCommerceOnboardingMetadata({
        supabase,
        commerce,
        lead,
        authUserId: existingOwner.data.auth_user_id,
        invitationSent: true,
      })

      await logOwnerInviteAttempt({
        supabase,
        leadId: lead.id,
        ownerEmail,
        sent: true,
        result: 'already_ready',
      }).catch(() => undefined)

      return jsonNoStore({
        ok: true,
        lead_id: lead.id,
        tenant_id: commerce.tenant_id,
        owner_auth_user_id: existingOwner.data.auth_user_id,
        owner_invitation_sent: true,
        result: 'already_ready',
      })
    }

    let authUserId = await findAuthUserIdByEmail(supabase, ownerEmail)
    let invitationSent = false

    if (!authUserId) {
      const invited = await supabase.auth.admin.inviteUserByEmail(ownerEmail, {
        redirectTo: resolveInviteRedirectUrl(),
        data: {
          tenant_id: commerce.tenant_id,
          rol: 'OWNER',
        },
      })

      if (invited.error || !invited.data.user?.id) {
        await syncCommerceOnboardingMetadata({
          supabase,
          commerce,
          lead,
          authUserId: null,
          invitationSent: false,
        }).catch(() => undefined)

        await logOwnerInviteAttempt({
          supabase,
          leadId: lead.id,
          ownerEmail,
          sent: false,
          result: 'invite_failed',
          errorMessage: invited.error?.message || 'No se pudo reenviar la invitación automática del OWNER.',
        }).catch(() => undefined)

        return jsonNoStore({ ok: false, error: 'invite_failed' }, 502)
      }

      authUserId = invited.data.user.id
      invitationSent = true
    }

    const owner = await ensureOwnerMembership({
      supabase,
      lead,
      commerce,
      authUserId,
    })

    await syncCommerceOnboardingMetadata({
      supabase,
      commerce,
      lead,
      authUserId: owner.auth_user_id,
      invitationSent: true,
    })

    await logOwnerInviteAttempt({
      supabase,
      leadId: lead.id,
      ownerEmail,
      sent: true,
      result: invitationSent ? 'invited' : 'linked_existing_user',
    }).catch(() => undefined)

    return jsonNoStore({
      ok: true,
      lead_id: lead.id,
      tenant_id: commerce.tenant_id,
      owner_auth_user_id: owner.auth_user_id,
      owner_invitation_sent: true,
      result: invitationSent ? 'invited' : 'linked_existing_user',
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }

    return jsonNoStore({ ok: false, error: 'unexpected' }, 500)
  }
}