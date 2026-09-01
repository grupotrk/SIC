import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { getPaymentConfig } from '@/lib/paymentConfig'

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

function maybeGetEnv(name: string): string {
  return (process.env[name] || '').trim()
}

export async function POST(req: Request) {
  try {
    const paymentConfig = getPaymentConfig()
    if (!paymentConfig.enabled || paymentConfig.provider !== 'mercadopago') {
      return NextResponse.json({ ok: false, error: 'payment_not_configured' }, { status: 503 })
    }

    const accessToken = getBearerToken(req)
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 })
    }

    const { data: comercioUsuario, error: roleError } = await supabase
      .from('comercio_usuarios')
      .select('tenant_id, rol, activo')
      .eq('auth_user_id', user.id)
      .eq('activo', true)
      .limit(1)
      .maybeSingle()

    if (roleError || !comercioUsuario?.tenant_id) {
      return NextResponse.json({ ok: false, error: 'role_not_configured' }, { status: 403 })
    }

    if (comercioUsuario.rol !== 'OWNER' && comercioUsuario.rol !== 'SUPERADMIN') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const { data: comercio, error: commerceError } = await supabase
      .from('comercios')
      .select('tenant_id, nombre, email')
      .eq('tenant_id', comercioUsuario.tenant_id)
      .maybeSingle()

    if (commerceError || !comercio) {
      return NextResponse.json({ ok: false, error: 'commerce_not_found' }, { status: 404 })
    }

    const mpToken = maybeGetEnv('MERCADOPAGO_ACCESS_TOKEN')
    const amount = Number.isFinite(paymentConfig.amount) ? paymentConfig.amount : 40000
    const backUrl = maybeGetEnv('PAYMENT_SUCCESS_URL')

    const body: Record<string, unknown> = {
      items: [
        {
          title: `SIDEA SIC · Renovación mensual — ${comercio.nombre || 'Comercio'}`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: amount,
        },
      ],
      // external_reference con el tenant_id para que el webhook lo identifique
      external_reference: comercio.tenant_id,
      metadata: {
        tenant_id: comercio.tenant_id,
        payment_type: 'renewal',
      },
    }

    if (comercio.email) {
      body.payer = { email: comercio.email }
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
        Authorization: `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'payment_link_failed' }, { status: 502 })
    }

    const data = await res.json()
    const checkoutUrl = String(data?.init_point || data?.sandbox_init_point || '').trim()

    if (!checkoutUrl) {
      return NextResponse.json({ ok: false, error: 'payment_link_empty' }, { status: 502 })
    }

    return NextResponse.json(
      {
        ok: true,
        checkout_url: checkoutUrl,
        amount,
        tenant_id: comercio.tenant_id,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
