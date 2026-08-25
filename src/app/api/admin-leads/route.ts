import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { getReferralType, normalizeReferralCode } from '@/lib/referralCode'
import { computeSubscriptionState } from '@/lib/subscriptionLifecycle'

type LeadRow = {
  id: string
  nombre_comercio: string | null
  rubro: string | null
  whatsapp: string | null
  email: string | null
  estado: string | null
  referral_code?: string | null
  plan_precio?: number | null
  created_at: string
}

type OwnerActivationStatus =
  | 'ready'
  | 'pending_invitation'
  | 'missing_email'
  | 'manual_review'
  | 'not_paid'

type CommerceRow = {
  tenant_id: string
  email: string | null
  metadata: Record<string, unknown> | null
  estado_suscripcion?: string | null
  suscripcion_vence_at?: string | null
  solo_descarga_hasta?: string | null
  baja_solicitada_at?: string | null
  activo?: boolean | null
  depurado_at?: string | null
}

type OwnerRow = {
  tenant_id: string
  auth_user_id: string | null
}

type OwnerInviteLogRow = {
  lead_id: string | null
  enviado: boolean | null
  error_message: string | null
  created_at: string
}

type AgentRow = {
  id: string
  nombre: string
  ref_code: string
  commission_rate: number | null
  status: string | null
}

type ClienteEstadoRow = LeadRow & {
  billing_status: string | null
  is_trial: boolean
  dias_transcurridos: number
  fecha_vencimiento: string
  vendedor_id: string | null
  vendedor_nombre: string | null
  vendedor_codigo: string | null
  vendedor_estado: string | null
  commission_rate: number
  precio_mensual: number
  comision_mensual: number
  ingreso_neto_mensual: number
  tenant_id: string | null
  owner_auth_user_id: string | null
  owner_activation_status: OwnerActivationStatus
  owner_activation_label: string | null
  owner_activation_detail: string | null
  owner_activation_needs_attention: boolean
  owner_invite_attempts: number
  owner_last_invite_at: string | null
  owner_last_invite_status: 'sent' | 'failed' | null
  owner_last_invite_error: string | null
}

function isPlaceholder(v: string | undefined): boolean {
  if (!v) return true
  return /YOUR_|REEMPLAZAR/i.test(v)
}

function getOwnerReferralCodes(): Set<string> {
  const raw = process.env.OWNER_REFERRAL_CODES ?? ''
  return new Set(
    raw
      .split(',')
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean)
  )
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function enrichLead(row: LeadRow): ClienteEstadoRow {
  const billingStatus = String(row.estado || '').trim().toUpperCase()
  const created = new Date(row.created_at)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const createdDate = new Date(created.getFullYear(), created.getMonth(), created.getDate())

  const diffMs = startOfToday.getTime() - createdDate.getTime()
  const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

  const fechaVenc = new Date(createdDate)
  fechaVenc.setDate(fechaVenc.getDate() + 30)

  let estado = 'Activo'
  if (fechaVenc < startOfToday) estado = 'Vencido'
  else if (fechaVenc.getTime() === startOfToday.getTime()) estado = 'Por vencer'

  return {
    ...row,
    billing_status: billingStatus,
    estado,
    dias_transcurridos: dias,
    fecha_vencimiento: fechaVenc.toISOString(),
    vendedor_id: null,
    vendedor_nombre: null,
    vendedor_codigo: row.referral_code ?? null,
    vendedor_estado: null,
    commission_rate: 0,
    precio_mensual: Number(row.plan_precio ?? 40000),
    comision_mensual: 0,
    ingreso_neto_mensual: Number(row.plan_precio ?? 40000),
    tenant_id: null,
    owner_auth_user_id: null,
    owner_activation_status: billingStatus === 'PAGADO' ? 'manual_review' : 'not_paid',
    owner_activation_label: null,
    owner_activation_detail: null,
    owner_activation_needs_attention: false,
    owner_invite_attempts: 0,
    owner_last_invite_at: null,
    owner_last_invite_status: null,
    owner_last_invite_error: null,
    is_trial: false,
  }
}

function mapCommerceStateToAdminStatus(
  commerce: CommerceRow | null,
  fallbackCreatedAt: string
): Pick<ClienteEstadoRow, 'estado' | 'dias_transcurridos' | 'fecha_vencimiento' | 'is_trial'> {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (!commerce) {
    const created = new Date(fallbackCreatedAt)
    const createdDate = new Date(created.getFullYear(), created.getMonth(), created.getDate())
    const dias = Math.max(0, Math.floor((startOfToday.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)))
    const fechaVenc = new Date(createdDate)
    fechaVenc.setDate(fechaVenc.getDate() + 30)
    let estado = 'Activo'
    if (fechaVenc < startOfToday) estado = 'Vencido'
    else if (fechaVenc.getTime() === startOfToday.getTime()) estado = 'Por vencer'
    return { estado, dias_transcurridos: dias, fecha_vencimiento: fechaVenc.toISOString(), is_trial: false }
  }

  const computed = computeSubscriptionState(commerce)
  const dueDate = commerce.suscripcion_vence_at
    ? new Date(`${commerce.suscripcion_vence_at}T00:00:00.000Z`)
    : null

  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))
    : 999

  const diasTranscurridos = dueDate
    ? Math.max(0, Math.floor((startOfToday.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  let estado: string
  if (computed.isTrial) {
    // Trial: mientras no venció = 'Trial'; en gracia = 'En gracia'; después = 'Vencido'
    estado =
      computed.status === 'ACTIVO' ? 'Trial'
      : computed.status === 'EN_GRACIA' ? 'En gracia'
      : 'Vencido'
  } else if (computed.status === 'ACTIVO') {
    // Por vencer si queda ≤7 días (umbral configurable)
    estado = dueDate && daysUntilDue > 0 && daysUntilDue <= 7 ? 'Por vencer' : 'Activo'
  } else if (computed.status === 'EN_GRACIA') {
    estado = 'En gracia'
  } else if (computed.status === 'SOLO_DESCARGA') {
    estado = 'Solo descarga'
  } else {
    estado = 'Vencido'
  }

  return {
    estado,
    dias_transcurridos: diasTranscurridos,
    fecha_vencimiento: dueDate ? dueDate.toISOString() : new Date(fallbackCreatedAt).toISOString(),
    is_trial: computed.isTrial,
  }
}

async function attachOwnerInviteLogData(
  rows: ClienteEstadoRow[],
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<ClienteEstadoRow[]> {
  const leadIds = Array.from(new Set(rows.map((row) => row.id).filter(Boolean)))
  if (leadIds.length === 0) {
    return rows
  }

  const logsRes = await supabase
    .from('notificacion_logs')
    .select('lead_id,enviado,error_message,created_at')
    .eq('tipo', 'EMAIL')
    .eq('motivo', 'OWNER_ACTIVACION')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: false })

  if (logsRes.error || !logsRes.data) {
    return rows
  }

  const logsByLead = new Map<string, OwnerInviteLogRow[]>()
  for (const rawLog of logsRes.data as OwnerInviteLogRow[]) {
    const leadId = String(rawLog.lead_id || '').trim()
    if (!leadId) continue
    const current = logsByLead.get(leadId) || []
    current.push(rawLog)
    logsByLead.set(leadId, current)
  }

  return rows.map((row) => {
    const logs = logsByLead.get(row.id) || []
    const latest = logs[0]

    return {
      ...row,
      owner_invite_attempts: logs.length,
      owner_last_invite_at: latest?.created_at ?? null,
      owner_last_invite_status:
        typeof latest?.enviado === 'boolean' ? (latest.enviado ? 'sent' : 'failed') : null,
      owner_last_invite_error: latest?.error_message ?? null,
    }
  })
}

async function attachOwnerActivationData(
  rows: ClienteEstadoRow[],
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<ClienteEstadoRow[]> {
  const paidEmails = Array.from(
    new Set(
      rows
        .filter((row) => row.billing_status === 'PAGADO' || row.billing_status === 'TRIAL_ACTIVO')
        .map((row) => normalizeEmail(row.email))
        .filter(Boolean)
    )
  )

  let commercesByEmail = new Map<string, CommerceRow>()
  if (paidEmails.length > 0) {
    const commercesRes = await supabase
      .from('comercios')
      .select('tenant_id,email,metadata,estado_suscripcion,suscripcion_vence_at,solo_descarga_hasta,baja_solicitada_at,activo,depurado_at')
      .in('email', paidEmails)

    if (!commercesRes.error && commercesRes.data) {
      commercesByEmail = new Map(
        (commercesRes.data as CommerceRow[])
          .map((commerce) => [normalizeEmail(commerce.email), commerce] as const)
          .filter(([email]) => Boolean(email))
      )
    }
  }

  const tenantIds = Array.from(new Set(Array.from(commercesByEmail.values()).map((commerce) => commerce.tenant_id)))
  let ownersByTenant = new Map<string, OwnerRow>()

  if (tenantIds.length > 0) {
    const ownersRes = await supabase
      .from('comercio_usuarios')
      .select('tenant_id,auth_user_id')
      .eq('rol', 'OWNER')
      .eq('activo', true)
      .in('tenant_id', tenantIds)

    if (!ownersRes.error && ownersRes.data) {
      ownersByTenant = new Map(
        (ownersRes.data as OwnerRow[]).map((owner) => [owner.tenant_id, owner] as const)
      )
    }
  }

  return rows.map((row) => {
    if (row.billing_status !== 'PAGADO' && row.billing_status !== 'TRIAL_ACTIVO') {
      return {
        ...row,
        owner_activation_status: 'not_paid',
        owner_activation_label: null,
        owner_activation_detail: null,
        owner_activation_needs_attention: false,
      }
    }

    const normalizedEmail = normalizeEmail(row.email)
    if (!normalizedEmail) {
      return {
        ...row,
        owner_activation_status: 'missing_email',
        owner_activation_label: 'Falta email del OWNER',
        owner_activation_detail: 'El comercio pagó, pero no hay email para enviar la activación.',
        owner_activation_needs_attention: true,
      }
    }

    const commerce = commercesByEmail.get(normalizedEmail)
    const lifecycle = mapCommerceStateToAdminStatus(commerce ?? null, row.created_at)
    const owner = commerce ? ownersByTenant.get(commerce.tenant_id) : undefined
    const metadata = commerce?.metadata && typeof commerce.metadata === 'object'
      ? commerce.metadata
      : null
    const metadataStatus = String(metadata?.owner_activation_status || '').trim().toUpperCase()
    const metadataInvitationSent = typeof metadata?.owner_invitation_sent === 'boolean'
      ? metadata.owner_invitation_sent
      : null

    if (owner?.auth_user_id || metadataStatus === 'LISTO') {
      return {
        ...row,
        ...lifecycle,
        tenant_id: commerce?.tenant_id ?? row.tenant_id,
        owner_auth_user_id: owner?.auth_user_id ?? row.owner_auth_user_id,
        owner_activation_status: 'ready',
        owner_activation_label: null,
        owner_activation_detail: null,
        owner_activation_needs_attention: false,
      }
    }

    if (commerce) {
      return {
        ...row,
        ...lifecycle,
        tenant_id: commerce.tenant_id,
        owner_activation_status: metadataStatus === 'SIN_EMAIL_OWNER' ? 'missing_email' : 'pending_invitation',
        owner_activation_label:
          metadataStatus === 'SIN_EMAIL_OWNER' ? 'Falta email del OWNER' : 'Activación OWNER pendiente',
        owner_activation_detail:
          metadataStatus === 'SIN_EMAIL_OWNER'
            ? 'El alta del comercio existe, pero falta un email válido para activar al dueño.'
            : metadataInvitationSent === false
              ? 'El comercio ya fue dado de alta, pero la invitación no pudo enviarse automáticamente.'
              : 'El comercio ya fue dado de alta y requiere revisar la activación del dueño.' ,
        owner_activation_needs_attention: true,
      }
    }

    return {
      ...row,
      ...lifecycle,
      owner_activation_status: 'manual_review',
      owner_activation_label: 'Revisar alta del OWNER',
      owner_activation_detail: 'El pago está aprobado, pero falta vincular la activación del dueño en el panel.',
      owner_activation_needs_attention: true,
    }
  })
}

function attachVendorData(rows: ClienteEstadoRow[], agents: AgentRow[]): ClienteEstadoRow[] {
  const byCode = new Map<string, AgentRow>()
  for (const a of agents) {
    byCode.set(String(a.ref_code || '').toUpperCase(), a)
  }

  const ownerCodes = getOwnerReferralCodes()

  return rows.map((row) => {
    const code = normalizeReferralCode(String(row.referral_code || ''))
    const codeType = getReferralType(code)
    const agent = code ? byCode.get(code) : undefined
    const isOwnerCode = code ? ownerCodes.has(code) || codeType === 'DI' || codeType === 'DU' : false
    const isTechnicalCode = codeType === 'CT'
    const price = Number(row.plan_precio ?? 40000)
    const rate = isOwnerCode ? 0 : agent ? Number(agent.commission_rate ?? 0.3) : 0.3
    const commission = Math.round(price * rate)

    return {
      ...row,
      vendedor_id: isOwnerCode || isTechnicalCode ? null : agent?.id ?? null,
      vendedor_nombre: isOwnerCode
        ? 'Propio (dueño)'
        : isTechnicalCode
          ? 'Cuerpo Técnico'
          : agent?.nombre ?? null,
      vendedor_codigo: row.referral_code ?? null,
      vendedor_estado: isOwnerCode ? 'owner' : isTechnicalCode ? 'technical' : agent?.status ?? null,
      commission_rate: rate,
      precio_mensual: price,
      comision_mensual: isOwnerCode ? 0 : commission,
      ingreso_neto_mensual:
        isOwnerCode ? price : Math.max(0, price - commission),
    }
  })
}

export async function GET() {
  try {
    if (!(await hasValidAdminSession())) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
      )
    }

    if (
      isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
      isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)
    ) {
      return NextResponse.json(
        { ok: false, error: 'server_not_configured' },
        { status: 503, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
      )
    }

    const supabase = getSupabaseAdmin()

    let agentsByCode: AgentRow[] = []
    const agentsRes = await supabase
      .from('sales_agents')
      .select('id,nombre,ref_code,commission_rate,status')

    if (!agentsRes.error && agentsRes.data) {
      agentsByCode = agentsRes.data as AgentRow[]
    }

    const fallback = await supabase
      .from('leads')
      .select('id,nombre_comercio,rubro,whatsapp,email,estado,referral_code,plan_precio,created_at')
      .in('estado', ['PAGADO', 'PENDIENTE', 'TRIAL_ACTIVO'])
      .order('created_at', { ascending: false })

    if (fallback.error || !fallback.data) {
      return NextResponse.json(
        { ok: false, error: 'db_error' },
        { status: 500, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
      )
    }

    const clientesConVendedor = attachVendorData((fallback.data as LeadRow[]).map(enrichLead), agentsByCode)
    const clientesConOwner = await attachOwnerActivationData(clientesConVendedor, supabase)
    const clientes = await attachOwnerInviteLogData(clientesConOwner, supabase)
    return NextResponse.json(
      { ok: true, clientes },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
    )
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return NextResponse.json(
        { ok: false, error: 'server_not_configured' },
        { status: 503, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
      )
    }

    return NextResponse.json(
      { ok: false, error: 'unexpected' },
      { status: 500, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
    )
  }
}
