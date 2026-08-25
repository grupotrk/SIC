import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

type MPWebhookPayload = {
  action?: string
  type?: string
  data?: { id?: string | number }
  resource?: string
  payment_id?: string | number
  lead_id?: string
}

type LeadRow = {
  id: string
  nombre_comercio: string | null
  rubro: string | null
  whatsapp: string | null
  email: string | null
  estado: string | null
}

type OwnerProvisionResult = {
  created: boolean
  authUserId: string | null
  invitationSent: boolean
}

type CommerceMetadata = Record<string, unknown>

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function mustGetEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function maybeGetEnv(name: string): string {
  return (process.env[name] || '').trim()
}

function normalizeRubroName(raw: string | null): string {
  const r = (raw || '').trim()
  if (!r) return 'Kioscos'
  const aliases: Record<string, string> = {
    Kiosco: 'Kioscos',
    Kioscos: 'Kioscos',
    Rotiseria: 'Rotisería',
    Rotisería: 'Rotisería',
    Quimica: 'Química',
    Química: 'Química',
    Carniceria: 'Carnicería',
    'Carnicería': 'Carnicería',
    'Carniceria/Verduleria': 'Carnicería/Verdulería',
    'Carnicería/Verdulería': 'Carnicería/Verdulería',
    Ferreteria: 'Ferretería',
    'Ferretería': 'Ferretería',
    Libreria: 'Librería',
    'Librería': 'Librería',
    'Tienda de Mascotas': 'Tienda de Mascotas',
  }
  return aliases[r] ?? r
}

function pickLeadIdFromPayment(payment: Record<string, unknown>, payload: MPWebhookPayload): string | null {
  const metadata = payment?.metadata as Record<string, unknown> | undefined
  const candidates = [
    payment?.external_reference,
    metadata?.lead_id,
    payload.lead_id,
  ]

  for (const c of candidates) {
    const value = String(c || '').trim()
    if (UUID_REGEX.test(value)) return value
  }
  return null
}

function extractPaymentId(payload: MPWebhookPayload): string | null {
  const direct = payload.data?.id ?? payload.payment_id
  if (direct != null && String(direct).trim() !== '') return String(direct)

  const resource = String(payload.resource || '').trim()
  if (!resource) return null
  const match = resource.match(/\/payments\/(\d+)/)
  return match?.[1] ?? null
}

async function fetchMercadoPagoPayment(paymentId: string, token: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`mp_fetch_failed_${res.status}`)
  }

  return res.json()
}

async function resolveRubroId(supabase: ReturnType<typeof getSupabaseAdmin>, rubroNombre: string): Promise<string | null> {
  const normalized = normalizeRubroName(rubroNombre)
  const { data } = await supabase.from('rubros').select('id,nombre')
  if (!data || data.length === 0) return null

  const exact = data.find((r) => r.nombre === normalized)
  if (exact) return exact.id

  // Fallback por prefijo simple para evitar frenar onboarding por variantes de texto
  const fallback = data.find((r) => r.nombre.toLowerCase().startsWith(normalized.toLowerCase().slice(0, 4)))
  return fallback?.id ?? null
}

async function resolvePlanId(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  const preferredPlan = (process.env.ONBOARDING_PLAN_NAME || 'Profesional').trim()
  const byName = await supabase.from('planes').select('id,nombre').eq('nombre', preferredPlan).maybeSingle()
  if (!byName.error && byName.data?.id) return byName.data.id

  const fallback = await supabase.from('planes').select('id').order('precio', { ascending: false }).limit(1).maybeSingle()
  return fallback.data?.id ?? null
}

async function provisionCommerceFromLead(supabase: ReturnType<typeof getSupabaseAdmin>, lead: LeadRow) {
  const rubroId = await resolveRubroId(supabase, lead.rubro || 'Kioscos')
  const planId = await resolvePlanId(supabase)
  if (!rubroId || !planId) {
    throw new Error('missing_rubro_or_plan')
  }

  const fallbackDomain = maybeGetEnv('FALLBACK_EMAIL_DOMAIN') || 'sic.local'
  const safeEmail = lead.email?.trim() || `${lead.id}@${fallbackDomain}`

  const existing = await supabase.from('comercios').select('tenant_id').eq('email', safeEmail).maybeSingle()
  if (!existing.error && existing.data?.tenant_id) {
    return { tenantId: existing.data.tenant_id, created: false }
  }

  const fallbackCommerceName = maybeGetEnv('FALLBACK_COMMERCE_NAME') || 'Comercio'
  const fallbackAddress = maybeGetEnv('FALLBACK_COMMERCE_ADDRESS') || 'A definir'
  const rpc = await supabase.rpc('registrar_comercio', {
    p_nombre: lead.nombre_comercio || fallbackCommerceName,
    p_email: safeEmail,
    p_telefono: lead.whatsapp || '',
    p_direccion: fallbackAddress,
    p_rubro_id: rubroId,
    p_plan_id: planId,
  })

  if (rpc.error || !rpc.data) {
    throw new Error('tenant_provision_failed')
  }

  return { tenantId: rpc.data as string, created: true }
}

async function findAuthUserIdByEmail(supabase: ReturnType<typeof getSupabaseAdmin>, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  const perPage = 200

  for (let page = 1; page <= 20; page += 1) {
    const listed = await supabase.auth.admin.listUsers({ page, perPage })
    if (listed.error) return null

    const users = listed.data.users || []
    const found = users.find((u) => String(u.email || '').trim().toLowerCase() === normalized)
    if (found?.id) return found.id
    if (users.length < perPage) break
  }

  return null
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

function resolvePublicAppBaseUrl(): string | null {
  const candidates = [maybeGetEnv('OWNER_INVITE_REDIRECT_URL'), maybeGetEnv('PAYMENT_SUCCESS_URL')]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      return `${url.protocol}//${url.host}`
    } catch {
      continue
    }
  }
  return null
}

function resolveOwnerActivationStatus(
  lead: LeadRow,
  ownerProvision: OwnerProvisionResult
): 'LISTO' | 'PENDIENTE_INVITACION' | 'SIN_EMAIL_OWNER' {
  if (ownerProvision.authUserId) {
    return 'LISTO'
  }

  if (!(lead.email || '').trim()) {
    return 'SIN_EMAIL_OWNER'
  }

  return 'PENDIENTE_INVITACION'
}

function datePlusDays(days: number): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + days)
  return now.toISOString().slice(0, 10)
}

function getSubscriptionDays(): { subscription: number; grace: number; downloadOnly: number } {
  return {
    subscription: parseInt(maybeGetEnv('SUBSCRIPTION_DAYS') || '30', 10),
    grace: parseInt(maybeGetEnv('SUBSCRIPTION_GRACE_DAYS') || '37', 10),
    downloadOnly: parseInt(maybeGetEnv('SUBSCRIPTION_DOWNLOAD_DAYS') || '120', 10),
  }
}

async function syncCommerceOnboardingMetadata(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  tenantId: string
  lead: LeadRow
  ownerProvision: OwnerProvisionResult
}) {
  const commerceRes = await input.supabase
    .from('comercios')
    .select('metadata')
    .eq('tenant_id', input.tenantId)
    .maybeSingle()

  if (commerceRes.error) {
    throw new Error('commerce_metadata_fetch_failed')
  }

  const currentMetadata =
    commerceRes.data?.metadata && typeof commerceRes.data.metadata === 'object'
      ? (commerceRes.data.metadata as CommerceMetadata)
      : {}

  const nextMetadata: CommerceMetadata = {
    ...currentMetadata,
    lead_id: input.lead.id,
    lead_email: (input.lead.email || '').trim().toLowerCase() || null,
    owner_email: (input.lead.email || '').trim().toLowerCase() || null,
    owner_auth_user_id: input.ownerProvision.authUserId,
    owner_invitation_sent: input.ownerProvision.invitationSent,
    owner_activation_status: resolveOwnerActivationStatus(input.lead, input.ownerProvision),
    owner_activation_updated_at: new Date().toISOString(),
  }

  const updateRes = await input.supabase
    .from('comercios')
    .update({ metadata: nextMetadata })
    .eq('tenant_id', input.tenantId)

  if (updateRes.error) {
    throw new Error('commerce_metadata_update_failed')
  }
}

async function sendResendEmail(input: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const apiKey = maybeGetEnv('RESEND_API_KEY')
  const from = maybeGetEnv('NOTIFICATION_FROM_EMAIL')
  if (!apiKey || !from) {
    return { sent: false, skipped: 'email_not_configured' as const }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    return { sent: false, error: `email_provider_${response.status}` as const }
  }

  return { sent: true }
}

async function sendPostPaymentNotifications(input: {
  lead: LeadRow
  tenantId: string
  paymentId: string
  amount: number | null
}) {
  const appBaseUrl = resolvePublicAppBaseUrl()
  const loginUrl = appBaseUrl ? `${appBaseUrl}/login` : null
  const adminEmail = maybeGetEnv('ADMIN_NOTIFICATION_EMAIL')

  const results: {
    admin: { sent: boolean; skipped?: string; error?: string }
    customer: { sent: boolean; skipped?: string; error?: string }
  } = {
    admin: { sent: false, skipped: 'admin_email_not_configured' },
    customer: { sent: false, skipped: 'customer_email_not_available' },
  }

  if (adminEmail) {
    results.admin = await sendResendEmail({
      to: adminEmail,
      subject: `Nuevo pago aprobado · ${input.lead.nombre_comercio || 'Comercio Trikode'}`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a;">
          <h2 style="color:#059669;">Pago aprobado en Trikode</h2>
          <p>Se acreditó una nueva suscripción del SIC.</p>
          <ul>
            <li><strong>Comercio:</strong> ${input.lead.nombre_comercio || 'Sin nombre'}</li>
            <li><strong>Rubro:</strong> ${input.lead.rubro || 'Sin rubro'}</li>
            <li><strong>WhatsApp:</strong> ${input.lead.whatsapp || 'Sin dato'}</li>
            <li><strong>Email cliente:</strong> ${input.lead.email || 'Sin dato'}</li>
            <li><strong>Pago ID:</strong> ${input.paymentId}</li>
            <li><strong>Tenant ID:</strong> ${input.tenantId}</li>
            <li><strong>Monto:</strong> ${input.amount != null ? `$${input.amount.toLocaleString('es-AR')} ARS` : 'Sin dato'}</li>
          </ul>
        </div>`,
      text: `Pago aprobado en Trikode\nComercio: ${input.lead.nombre_comercio || 'Sin nombre'}\nRubro: ${input.lead.rubro || 'Sin rubro'}\nWhatsApp: ${input.lead.whatsapp || 'Sin dato'}\nEmail cliente: ${input.lead.email || 'Sin dato'}\nPago ID: ${input.paymentId}\nTenant ID: ${input.tenantId}\nMonto: ${input.amount != null ? `$${input.amount.toLocaleString('es-AR')} ARS` : 'Sin dato'}`,
    })
  }

  const customerEmail = (input.lead.email || '').trim().toLowerCase()
  if (customerEmail) {
    results.customer = await sendResendEmail({
      to: customerEmail,
      subject: 'Gracias por suscribirte a Trikode SIC',
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#0f172a;">
          <h2 style="color:#059669;">Gracias por suscribirte a Trikode</h2>
          <p>Tu pago fue recibido correctamente y el alta de <strong>${input.lead.nombre_comercio || 'tu comercio'}</strong> ya fue procesada.</p>
          <p>En breve vas a recibir el correo de activación para el acceso del dueño al SIC.</p>
          ${loginUrl ? `<p>Luego podrás ingresar desde <a href="${loginUrl}">${loginUrl}</a>.</p>` : ''}
          <p>Gracias por confiar en Trikode Ingeniería para el control interno de tu negocio.</p>
        </div>`,
      text: `Gracias por suscribirte a Trikode. Tu pago fue recibido correctamente y el alta de ${input.lead.nombre_comercio || 'tu comercio'} ya fue procesada. En breve vas a recibir el correo de activación para el acceso del dueño al SIC.${loginUrl ? ` Luego podrás ingresar desde ${loginUrl}.` : ''}`,
    })
  }

  return results
}

async function ensureOwnerUserForTenant(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  lead: LeadRow,
  tenantId: string
): Promise<OwnerProvisionResult> {
  const ownerExisting = await supabase
    .from('comercio_usuarios')
    .select('id,auth_user_id')
    .eq('tenant_id', tenantId)
    .eq('rol', 'OWNER')
    .eq('activo', true)
    .maybeSingle()

  if (!ownerExisting.error && ownerExisting.data?.auth_user_id) {
    return { created: false, authUserId: ownerExisting.data.auth_user_id, invitationSent: true }
  }

  const ownerEmail = (lead.email || '').trim().toLowerCase()
  if (!ownerEmail) {
    return { created: false, authUserId: null, invitationSent: false }
  }

  let authUserId = await findAuthUserIdByEmail(supabase, ownerEmail)
  let invitationSent = false

  if (!authUserId) {
    const inviteRedirectTo = resolveInviteRedirectUrl()
    const invited = await supabase.auth.admin.inviteUserByEmail(ownerEmail, {
      redirectTo: inviteRedirectTo,
      data: {
        tenant_id: tenantId,
        rol: 'OWNER',
      },
    })

    if (!invited.error && invited.data.user?.id) {
      authUserId = invited.data.user.id
      invitationSent = true
    } else {
      return { created: false, authUserId: null, invitationSent: false }
    }
  }

  const existingByAuth = await supabase
    .from('comercio_usuarios')
    .select('id,tenant_id,rol')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (!existingByAuth.error && existingByAuth.data) {
    if (existingByAuth.data.tenant_id === tenantId && existingByAuth.data.rol === 'OWNER') {
      return { created: false, authUserId, invitationSent: true }
    }
    throw new Error('owner_user_conflict')
  }

  const ins = await supabase.from('comercio_usuarios').insert({
    tenant_id: tenantId,
    auth_user_id: authUserId,
    nombre: displayOwnerName(lead),
    email: ownerEmail.slice(0, 100),
    rol: 'OWNER',
    activo: true,
    metadata: {
      source: 'payment_webhook',
      lead_id: lead.id,
      login_username: await resolveUniqueRoleLoginUsername(
        supabase,
        'OWNER',
        buildOwnerLoginUsername(lead, tenantId)
      ),
    },
  })

  if (ins.error) {
    if (ins.error.code === '23505') {
      return { created: false, authUserId, invitationSent: true }
    }
    throw new Error('owner_link_failed')
  }

  return { created: true, authUserId, invitationSent }
}

// ---------------------------------------------------------------------------
// Renovaciones: pagos de comercios ya activos que renuevan su suscripción
// ---------------------------------------------------------------------------
async function handleRenewalPayment(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  paymentId: string,
  amount: number | null
): Promise<NextResponse> {
  const { data: comercio } = await supabase
    .from('comercios')
    .select('tenant_id, nombre, email')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!comercio) {
    return NextResponse.json({ ok: false, error: 'tenant_not_found' }, { status: 404 })
  }

  const subDays = getSubscriptionDays()
  const { error: updateError } = await supabase
    .from('comercios')
    .update({
      estado_suscripcion: 'ACTIVO',
      suscripcion_vence_at: datePlusDays(subDays.subscription),
      gracia_hasta: datePlusDays(subDays.grace),
      solo_descarga_hasta: datePlusDays(subDays.downloadOnly),
      ultimo_pago_at: new Date().toISOString(),
      baja_solicitada_at: null,
      baja_motivos: [],
      baja_detalle: null,
      baja_permite_contacto: false,
      depurado_at: null,
      activo: true,
    })
    .eq('tenant_id', tenantId)

  if (updateError) {
    return NextResponse.json({ ok: false, error: 'renewal_update_failed' }, { status: 500 })
  }

  // Notificación interna al admin
  const adminEmail = maybeGetEnv('ADMIN_NOTIFICATION_EMAIL')
  if (adminEmail) {
    await sendResendEmail({
      to: adminEmail,
      subject: `Renovación recibida · ${comercio.nombre || tenantId}`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a;">
        <h2 style="color:#059669;">Renovación de suscripción</h2>
        <ul>
          <li><strong>Comercio:</strong> ${comercio.nombre || 'Sin nombre'}</li>
          <li><strong>Tenant ID:</strong> ${tenantId}</li>
          <li><strong>Pago ID:</strong> ${paymentId}</li>
          <li><strong>Monto:</strong> ${amount != null ? `$${amount.toLocaleString('es-AR')} ARS` : 'Sin dato'}</li>
        </ul>
      </div>`,
      text: `Renovación\nComercio: ${comercio.nombre || 'Sin nombre'}\nTenant ID: ${tenantId}\nPago ID: ${paymentId}\nMonto: ${amount != null ? `$${amount.toLocaleString('es-AR')} ARS` : 'Sin dato'}`,
    }).catch(() => undefined)
  }

  // Confirmación al dueño del comercio
  const ownerEmail = String(comercio.email || '').trim().toLowerCase()
  if (ownerEmail) {
    const appBaseUrl = resolvePublicAppBaseUrl()
    const loginUrl = appBaseUrl ? `${appBaseUrl}/login` : null
    await sendResendEmail({
      to: ownerEmail,
      subject: 'Tu suscripción a Trikode SIC fue renovada',
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#0f172a;">
        <h2 style="color:#059669;">Suscripción renovada con éxito</h2>
        <p>Recibimos tu pago y tu cuenta ya está activa por un mes más.</p>
        ${loginUrl ? `<p>Podés acceder desde <a href="${loginUrl}">${loginUrl}</a>.</p>` : ''}
        <p>Gracias por seguir confiando en Trikode Ingeniería.</p>
      </div>`,
      text: `Suscripción renovada. Tu cuenta ya está activa por un mes más.${loginUrl ? ` Accedé desde ${loginUrl}.` : ''}`,
    }).catch(() => undefined)
  }

  return NextResponse.json(
    { ok: true, type: 'renewal', tenant_id: tenantId, payment_id: paymentId },
    { status: 200 }
  )
}

export async function POST(req: Request) {
  try {
    const webhookSecret = mustGetEnv('PAYMENT_WEBHOOK_SECRET')
    const suppliedSecret = req.headers.get('x-webhook-secret') || ''
    // Comparación en tiempo constante: se usa webhookSecret como clave HMAC
    // para normalizar la longitud del output y evitar timing attacks.
    const ha = createHmac('sha256', webhookSecret).update(suppliedSecret).digest()
    const hb = createHmac('sha256', webhookSecret).update(webhookSecret).digest()
    if (!timingSafeEqual(ha, hb)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const payload = (await req.json().catch(() => null)) as MPWebhookPayload | null
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    const paymentId = extractPaymentId(payload)
    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: 'missing_payment_id' }, { status: 202 })
    }

    const mpToken = mustGetEnv('MERCADOPAGO_ACCESS_TOKEN')
    const payment = await fetchMercadoPagoPayment(paymentId, mpToken)
    if (String(payment?.status || '').toLowerCase() !== 'approved') {
      return NextResponse.json({ ok: true, ignored: `status_${payment?.status || 'unknown'}` }, { status: 202 })
    }

    // Renovaciones: el pago tiene metadata.payment_type === 'renewal'
    const paymentMeta = payment?.metadata as Record<string, unknown> | undefined
    if (String(paymentMeta?.payment_type || '') === 'renewal') {
      const renewalTenantId = String(paymentMeta?.tenant_id || '').trim()
      if (!UUID_REGEX.test(renewalTenantId)) {
        return NextResponse.json({ ok: true, ignored: 'renewal_missing_tenant_id' }, { status: 202 })
      }
      const supabaseR = getSupabaseAdmin()
      return handleRenewalPayment(
        supabaseR,
        renewalTenantId,
        paymentId,
        typeof payment?.transaction_amount === 'number' ? payment.transaction_amount : null
      )
    }

    const leadId = pickLeadIdFromPayment(payment, payload)
    if (!leadId) {
      return NextResponse.json({ ok: true, ignored: 'missing_lead_id' }, { status: 202 })
    }

    const supabase = getSupabaseAdmin()
    const leadRes = await supabase
      .from('leads')
      .select('id,nombre_comercio,rubro,whatsapp,email,estado')
      .eq('id', leadId)
      .maybeSingle()

    if (leadRes.error || !leadRes.data) {
      return NextResponse.json({ ok: false, error: 'lead_not_found' }, { status: 404 })
    }

    const lead = leadRes.data as LeadRow
    const alreadyPaid = (lead.estado || '').toUpperCase() === 'PAGADO'

    if (!alreadyPaid) {
      const upd = await supabase.from('leads').update({ estado: 'PAGADO' }).eq('id', lead.id)
      if (upd.error) {
        return NextResponse.json({ ok: false, error: 'lead_update_failed' }, { status: 500 })
      }
    }

    const provision = await provisionCommerceFromLead(supabase, lead)
    const ownerProvision = await ensureOwnerUserForTenant(supabase, lead, provision.tenantId)

    await syncCommerceOnboardingMetadata({
      supabase,
      tenantId: provision.tenantId,
      lead,
      ownerProvision,
    }).catch(() => undefined)

    const subDays = getSubscriptionDays()
    await supabase
      .from('comercios')
      .update({
        estado_suscripcion: 'ACTIVO',
        suscripcion_vence_at: datePlusDays(subDays.subscription),
        gracia_hasta: datePlusDays(subDays.grace),
        solo_descarga_hasta: datePlusDays(subDays.downloadOnly),
        ultimo_pago_at: new Date().toISOString(),
        baja_solicitada_at: null,
        baja_motivos: [],
        baja_detalle: null,
        baja_permite_contacto: false,
        depurado_at: null,
        activo: true,
      })
      .eq('tenant_id', provision.tenantId)

    let notifications:
      | {
          admin: { sent: boolean; skipped?: string; error?: string }
          customer: { sent: boolean; skipped?: string; error?: string }
        }
      | null = null

    if (!alreadyPaid) {
      notifications = await sendPostPaymentNotifications({
        lead,
        tenantId: provision.tenantId,
        paymentId,
        amount:
          typeof payment?.transaction_amount === 'number'
            ? payment.transaction_amount
            : null,
      }).catch(() => ({
        admin: { sent: false, error: 'notification_failed' },
        customer: { sent: false, error: 'notification_failed' },
      }))
    }

    return NextResponse.json(
      {
        ok: true,
        lead_id: lead.id,
        payment_id: paymentId,
        tenant_id: provision.tenantId,
        lead_marked_paid: !alreadyPaid,
        tenant_created: provision.created,
        owner_user_created: ownerProvision.created,
        owner_auth_user_id: ownerProvision.authUserId,
        owner_invitation_sent: ownerProvision.invitationSent,
        notifications,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return NextResponse.json({ ok: false, error: 'server_not_configured' }, { status: 503 })
    }
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
