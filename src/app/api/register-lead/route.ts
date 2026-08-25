import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { isValidReferralCode, normalizeReferralCode } from '@/lib/referralCode'

type LeadInput = {
  nombre_comercio: string
  rubro: string
  whatsapp: string
  email: string  // requerido: necesario para invitar al owner
  mensaje?: string | null
  referral_code?: string | null
  accepted_terms?: boolean
}

const TERMS_VERSION = 'v1.0'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
const WHATSAPP_REGEX = /^[0-9+\-\s()]{7,20}$/

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function truncate(s: string, max: number): string {
  return s.slice(0, max)
}

function maybeGetEnv(name: string): string {
  return (process.env[name] || '').trim()
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return truncate(first, 64)
  }
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return truncate(realIp, 64)
  return null
}

// ─── MercadoPago ─────────────────────────────────────────────────────────────

async function createMercadoPagoPreference(input: {
  leadId: string
  nombreComercio: string
  email: string | null
  referralCode: string | null
  amount: number
}) {
  const token = maybeGetEnv('MERCADOPAGO_ACCESS_TOKEN')
  if (!token) return null

  const backUrl = maybeGetEnv('PAYMENT_SUCCESS_URL')
  const body: Record<string, unknown> = {
    items: [
      {
        title: `Trikode Completo - ${input.nombreComercio}`,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: Number(input.amount),
      },
    ],
    external_reference: input.leadId,
    metadata: {
      lead_id: input.leadId,
      referral_code: input.referralCode,
    },
  }

  if (input.email) {
    body.payer = { email: input.email }
  }

  if (backUrl) {
    body.back_urls = {
      success: backUrl,
      pending: backUrl,
      failure: backUrl,
    }
    body.auto_return = 'approved'
  }

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) return null
  const data = await res.json()
  const link = String(data?.init_point || data?.sandbox_init_point || '').trim()
  if (!link) return null

  return {
    link,
    preferenceId: String(data?.id || '').trim() || null,
  }
}

// ─── Trial: helpers de URL ────────────────────────────────────────────────────

function resolveTrialRedirectUrl(): string | undefined {
  const direct = maybeGetEnv('OWNER_INVITE_REDIRECT_URL')
  if (direct) return direct
  const fromSuccess = maybeGetEnv('PAYMENT_SUCCESS_URL')
  if (!fromSuccess) return undefined
  try {
    const url = new URL(fromSuccess)
    url.pathname = '/set-password'
    url.search = ''
    return url.toString()
  } catch {
    return undefined
  }
}

function resolveTrialAppBaseUrl(): string | null {
  for (const key of ['OWNER_INVITE_REDIRECT_URL', 'PAYMENT_SUCCESS_URL']) {
    const v = maybeGetEnv(key)
    if (!v) continue
    try {
      const url = new URL(v)
      return `${url.protocol}//${url.host}`
    } catch {
      continue
    }
  }
  return null
}

// ─── Trial: email de bienvenida ───────────────────────────────────────────────

async function sendTrialWelcomeEmail(input: {
  to: string
  commerceName: string
  trialDays: number
  trialEndsAt: string
  loginUrl: string | null
  mpCheckoutUrl: string | null
}) {
  const apiKey = maybeGetEnv('RESEND_API_KEY')
  const from = maybeGetEnv('NOTIFICATION_FROM_EMAIL')
  if (!apiKey || !from) return

  const dueDateFormatted = new Date(input.trialEndsAt + 'T00:00:00Z').toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:600px;">
      <h2 style="color:#059669;">¡Bienvenido a Trikode SIC!</h2>
      <p>Tu período de prueba gratuito para <strong>${input.commerceName}</strong> ya está activo.</p>
      <p>Tenés <strong>${input.trialDays} días</strong> para probar el sistema completo, sin ningún costo.
         Tu prueba vence el <strong>${dueDateFormatted}</strong>.</p>
      <p>En breve vas a recibir otro correo con el link para definir tu contraseña de acceso.</p>
      ${input.loginUrl ? `<p>Una vez que actives tu cuenta, ingresá al sistema desde: <a href="${input.loginUrl}" style="color:#059669;">${input.loginUrl}</a></p>` : ''}
      ${input.mpCheckoutUrl ? `
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
      <p><strong>¿Querés activar tu suscripción antes del vencimiento?</strong></p>
      <p>Podés hacerlo en cualquier momento desde este link:</p>
      <a href="${input.mpCheckoutUrl}"
         style="display:inline-block;background:#059669;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:4px;">
        Activar suscripción mensual →
      </a>
      ` : ''}
      <p style="color:#64748b;font-size:13px;margin-top:24px;">Trikode Ingeniería · Sistema Integral de Comercios</p>
    </div>
  `

  const text = `¡Bienvenido a Trikode SIC! Tu período de prueba gratuito para ${input.commerceName} está activo por ${input.trialDays} días, hasta el ${dueDateFormatted}.${input.loginUrl ? ` Accedé desde ${input.loginUrl}.` : ''}${input.mpCheckoutUrl ? ` Para activar tu suscripción mensual: ${input.mpCheckoutUrl}` : ''}`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `¡Tu prueba gratuita de ${input.trialDays} días en Trikode SIC empieza hoy!`,
      html,
      text,
    }),
    cache: 'no-store',
  })
}

// ─── Trial: provisión completa ────────────────────────────────────────────────

async function provisionTrial(input: {
  leadId: string
  nombreComercio: string
  email: string
  whatsapp: string
  rubro: string
  trialDays: number
  mpCheckoutUrl: string | null
}): Promise<{ trialEndsAt: string; ownerInvited: boolean }> {
  const supabase = getSupabaseAdmin()
  const safeEmail = input.email.trim().toLowerCase()

  // 1. Resolver rubro y plan
  const { data: rubros } = await supabase.from('rubros').select('id,nombre')
  const normalizedRubro = input.rubro.trim()
  const rubroRow =
    rubros?.find((r) => r.nombre === normalizedRubro) ||
    rubros?.find((r) =>
      r.nombre.toLowerCase().startsWith(normalizedRubro.toLowerCase().slice(0, 4))
    )
  if (!rubroRow?.id) throw new Error('rubro_not_found')

  const { data: planRow } = await supabase
    .from('planes')
    .select('id')
    .order('precio', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!planRow?.id) throw new Error('plan_not_found')

  // 2. Provisionar o reusar comercio existente
  const { data: existing } = await supabase
    .from('comercios')
    .select('tenant_id')
    .eq('email', safeEmail)
    .maybeSingle()

  let tenantId: string
  if (existing?.tenant_id) {
    tenantId = existing.tenant_id
  } else {
    const { data: rpcData, error: rpcError } = await supabase.rpc('registrar_comercio', {
      p_nombre: input.nombreComercio || maybeGetEnv('FALLBACK_COMMERCE_NAME') || 'Comercio',
      p_email: safeEmail,
      p_telefono: input.whatsapp || '',
      p_direccion: maybeGetEnv('FALLBACK_COMMERCE_ADDRESS') || 'A definir',
      p_rubro_id: rubroRow.id,
      p_plan_id: planRow.id,
    })
    if (rpcError || !rpcData) throw new Error('tenant_provision_failed')
    tenantId = rpcData as string
  }

  // 3. Fijar fechas de trial
  const trialEnd = new Date()
  trialEnd.setUTCDate(trialEnd.getUTCDate() + input.trialDays)
  const trialEndsAt = trialEnd.toISOString().slice(0, 10)

  const graceEnd = new Date(trialEnd)
  graceEnd.setUTCDate(graceEnd.getUTCDate() + 7)

  const downloadEnd = new Date(trialEnd)
  downloadEnd.setUTCDate(
    downloadEnd.getUTCDate() + parseInt(maybeGetEnv('SUBSCRIPTION_DOWNLOAD_DAYS') || '120', 10)
  )

  await supabase
    .from('comercios')
    .update({
      estado_suscripcion: 'TRIAL',
      suscripcion_vence_at: trialEndsAt,
      gracia_hasta: graceEnd.toISOString().slice(0, 10),
      solo_descarga_hasta: downloadEnd.toISOString().slice(0, 10),
      activo: true,
    })
    .eq('tenant_id', tenantId)

  // 4. Invitar al owner
  const redirectTo = resolveTrialRedirectUrl()
  let ownerInvited = false

  try {
    // Buscar si ya existe el usuario en auth
    let existingAuthUserId: string | null = null
    for (let page = 1; page <= 5; page++) {
      const listResult = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      if (listResult.error || !listResult.data?.users) break
      const users = listResult.data.users
      const found = users.find(
        (u) => String(u.email || '').trim().toLowerCase() === safeEmail
      )
      if (found?.id) {
        existingAuthUserId = found.id
        break
      }
      if (users.length < 200) break
    }

    let authUserId = existingAuthUserId
    if (!authUserId) {
      const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
        safeEmail,
        redirectTo ? { redirectTo } : undefined
      )
      if (!inviteErr && invited?.user?.id) {
        authUserId = invited.user.id
        ownerInvited = true
      }
    }

    if (authUserId) {
      await supabase.from('comercio_usuarios').upsert(
        {
          tenant_id: tenantId,
          auth_user_id: authUserId,
          nombre: input.nombreComercio || 'Owner',
          email: safeEmail,
          rol: 'OWNER',
          activo: true,
          metadata: { lead_id: input.leadId, provisioned_via: 'trial' },
        },
        { onConflict: 'tenant_id,email' }
      )
    }
  } catch {
    // El invite falla silenciosamente — el admin puede reenviar desde el dashboard
  }

  // 5. Marcar lead como TRIAL_ACTIVO
  await supabase.from('leads').update({ estado: 'TRIAL_ACTIVO' }).eq('id', input.leadId)

  // 6. Email de bienvenida con link de pago para cuando quieran activar
  const appBaseUrl = resolveTrialAppBaseUrl()
  await sendTrialWelcomeEmail({
    to: safeEmail,
    commerceName: input.nombreComercio,
    trialDays: input.trialDays,
    trialEndsAt,
    loginUrl: appBaseUrl ? `${appBaseUrl}/login` : null,
    mpCheckoutUrl: input.mpCheckoutUrl,
  }).catch(() => undefined)

  return { trialEndsAt, ownerInvited }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as null | Partial<LeadInput>
    if (!body) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })

    const nombre_comercio = truncate(asString(body.nombre_comercio).trim(), 200)
    const rubro = truncate(asString(body.rubro).trim(), 100)
    const whatsapp = truncate(asString(body.whatsapp).trim(), 30)
    // Email obligatorio — necesario para invitar al owner al sistema
    const email = typeof body.email === 'string' ? truncate(body.email.trim(), 254) : ''
    const mensaje = typeof body.mensaje === 'string' ? truncate(body.mensaje.trim(), 1000) : null
    const referral_code_raw = typeof body.referral_code === 'string' ? body.referral_code : ''
    const referral_code_normalized = normalizeReferralCode(referral_code_raw)
    const referral_code = truncate(referral_code_normalized, 20) || null
    const accepted_terms = body.accepted_terms === true
    const tos_ip = getClientIp(req)

    if (!nombre_comercio || !rubro || !whatsapp || !email) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
    }

    if (!accepted_terms) {
      return NextResponse.json({ ok: false, error: 'terms_required' }, { status: 400 })
    }

    if (!WHATSAPP_REGEX.test(whatsapp)) {
      return NextResponse.json({ ok: false, error: 'invalid_whatsapp' }, { status: 400 })
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
    }

    if (referral_code && !isValidReferralCode(referral_code)) {
      return NextResponse.json({ ok: false, error: 'invalid_referral_code' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          nombre_comercio,
          rubro,
          whatsapp,
          email,
          mensaje,
          referral_code,
          accepted_terms,
          tos_version: TERMS_VERSION,
          tos_accepted_at: new Date().toISOString(),
          tos_ip,
          plan: 'Completo',
          plan_precio: parseInt(maybeGetEnv('SUBSCRIPTION_PRICE') || '40000', 10),
          mercado_pago_link: null,
          estado: 'PENDIENTE',
        },
      ])
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const trialDays = parseInt(maybeGetEnv('TRIAL_DAYS') || '0', 10)

    // Generar link de MP siempre (usado en el email de bienvenida del trial y en el flujo directo)
    const preference = await createMercadoPagoPreference({
      leadId: data.id,
      nombreComercio: nombre_comercio,
      email,
      referralCode: referral_code,
      amount: parseInt(maybeGetEnv('SUBSCRIPTION_PRICE') || '40000', 10),
    })

    // Guardar el link de MP en el lead independientemente del flujo
    if (preference?.link) {
      await supabase.from('leads').update({ mercado_pago_link: preference.link }).eq('id', data.id)
    }

    if (trialDays > 0) {
      // ── Flujo trial: provisionar inmediatamente, enviar email de bienvenida ──
      try {
        const trial = await provisionTrial({
          leadId: data.id,
          nombreComercio: nombre_comercio,
          email,
          whatsapp,
          rubro,
          trialDays,
          mpCheckoutUrl: preference?.link || null,
        })

        return NextResponse.json(
          {
            ok: true,
            is_trial: true,
            lead_id: data.id,
            trial_days: trialDays,
            trial_ends_at: trial.trialEndsAt,
            owner_invited: trial.ownerInvited,
          },
          { status: 200 }
        )
      } catch {
        return NextResponse.json({ ok: false, error: 'trial_provision_failed' }, { status: 500 })
      }
    }

    // ── Flujo pago directo (TRIAL_DAYS=0): requiere pago antes de acceder ──
    if (!preference?.link) {
      return NextResponse.json(
        { ok: false, error: 'payment_link_unavailable' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        lead_id: data.id,
        mercado_pago_link: preference.link,
        has_dynamic_preference: true,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
