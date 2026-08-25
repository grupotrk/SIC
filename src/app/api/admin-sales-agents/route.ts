import { randomInt } from 'crypto'
import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

type SalesAgentRow = {
  id: string
  nombre: string
  whatsapp: string | null
  email: string | null
  ref_code: string
  status: 'active' | 'inactive'
  commission_rate: number | null
  active_from: string | null
  inactive_from: string | null
  created_at: string
  updated_at: string
}

type CreateBody = {
  nombre?: unknown
  whatsapp?: unknown
  email?: unknown
  commission_rate?: unknown
  referral_type?: unknown
}

type UpdateBody = {
  id?: unknown
  action?: unknown
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
type ReferralType = 'AV' | 'CT' | 'DU'

function mustGetEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized === '' ||
    normalized.includes('your_project') ||
    normalized.includes('your-project') ||
    normalized.includes('your_anon_key') ||
    normalized.includes('your-anon-key') ||
    normalized.includes('your_service_role_key') ||
    normalized.includes('your-service-role-key') ||
    normalized.includes('placeholder')
  )
}

function hasConfiguredSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return !isPlaceholder(url) && !isPlaceholder(serviceRole)
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

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function normalizeWhatsapp(raw: string): string | null {
  const cleaned = raw.trim()
  if (!cleaned) return null
  return cleaned.slice(0, 20)
}

function normalizeEmail(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase()
  if (!cleaned) return null
  return cleaned.slice(0, 100)
}

function randomBody(len = 4): string {
  let out = ''
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[randomInt(0, ALPHABET.length)]
  }
  return out
}

function parseReferralType(raw: unknown): ReferralType | null {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  if (value === 'AV' || value === 'CT' || value === 'DU') return value
  return null
}

async function generateUniqueReferralCode(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  prefix: ReferralType
): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = `TKI-${prefix}-${randomBody(4)}`
    const { data, error } = await supabase
      .from('sales_agents')
      .select('id')
      .eq('ref_code', code)
      .maybeSingle()

    if (error) {
      continue
    }

    if (!data) {
      return code
    }
  }

  throw new Error('code_generation_failed')
}

async function listSalesAgents(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from('sales_agents')
    .select('id,nombre,whatsapp,email,ref_code,status,commission_rate,active_from,inactive_from,created_at,updated_at')
    .order('status', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) {
    return jsonNoStore({ ok: false, error: 'db_error' }, 500)
  }

  return jsonNoStore({ ok: true, agents: (data || []) as SalesAgentRow[] }, 200)
}

async function createOrRejoinSalesAgent(req: Request, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const body = (await req.json().catch(() => null)) as CreateBody | null
  if (!body) {
    return jsonNoStore({ ok: false, error: 'invalid_json' }, 400)
  }

  const nombre = normalizeName(typeof body.nombre === 'string' ? body.nombre : '')
  if (!nombre || nombre.length < 2) {
    return jsonNoStore({ ok: false, error: 'invalid_name' }, 400)
  }

  const whatsapp = normalizeWhatsapp(typeof body.whatsapp === 'string' ? body.whatsapp : '')
  const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
  const referralType = parseReferralType(body.referral_type ?? 'AV')
  if (!referralType) {
    return jsonNoStore({ ok: false, error: 'invalid_referral_type' }, 400)
  }

  const commissionRate = referralType === 'DU' ? 0 : 0.3

  const byName = await supabase
    .from('sales_agents')
    .select('id,nombre,status')
    .ilike('nombre', nombre)
    .order('created_at', { ascending: false })

  if (byName.error) {
    return jsonNoStore({ ok: false, error: 'db_error' }, 500)
  }

  const existing = (byName.data || []) as Array<{ id: string; nombre: string; status: 'active' | 'inactive' }>
  const active = existing.find((row) => row.status === 'active')

  if (active) {
    return jsonNoStore({ ok: false, error: 'active_agent_exists' }, 409)
  }

  const code = await generateUniqueReferralCode(supabase, referralType)
  const nowIso = new Date().toISOString()
  const inactive = existing.find((row) => row.status === 'inactive')

  if (inactive) {
    const upd = await supabase
      .from('sales_agents')
      .update({
        nombre,
        whatsapp,
        email,
        ref_code: code,
        status: 'active',
        commission_rate: commissionRate,
        active_from: nowIso,
        inactive_from: null,
      })
      .eq('id', inactive.id)

    if (upd.error) {
      return jsonNoStore({ ok: false, error: 'update_failed' }, 500)
    }

    return jsonNoStore({ ok: true, mode: 'rejoined', ref_code: code, referral_type: referralType }, 200)
  }

  const ins = await supabase.from('sales_agents').insert({
    nombre,
    whatsapp,
    email,
    ref_code: code,
    status: 'active',
    commission_rate: commissionRate,
    active_from: nowIso,
    inactive_from: null,
  })

  if (ins.error) {
    return jsonNoStore({ ok: false, error: 'insert_failed' }, 500)
  }

  return jsonNoStore({ ok: true, mode: 'created', ref_code: code, referral_type: referralType }, 201)
}

async function deactivateSalesAgent(req: Request, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const body = (await req.json().catch(() => null)) as UpdateBody | null
  if (!body) {
    return jsonNoStore({ ok: false, error: 'invalid_json' }, 400)
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const action = typeof body.action === 'string' ? body.action.trim() : ''

  if (!id || action !== 'deactivate') {
    return jsonNoStore({ ok: false, error: 'invalid_input' }, 400)
  }

  const upd = await supabase
    .from('sales_agents')
    .update({
      status: 'inactive',
      inactive_from: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'active')

  if (upd.error) {
    return jsonNoStore({ ok: false, error: 'update_failed' }, 500)
  }

  return jsonNoStore({ ok: true }, 200)
}

export async function GET() {
  try {
    if (!(await hasValidAdminSession())) {
      return jsonNoStore({ ok: false, error: 'unauthorized' }, 401)
    }

    mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
    mustGetEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!hasConfiguredSupabaseEnv()) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }

    return await listSalesAgents(getSupabaseAdmin())
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }
    return jsonNoStore({ ok: false, error: 'unexpected' }, 500)
  }
}

export async function POST(req: Request) {
  try {
    if (!(await hasValidAdminSession())) {
      return jsonNoStore({ ok: false, error: 'unauthorized' }, 401)
    }

    mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
    mustGetEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!hasConfiguredSupabaseEnv()) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }

    return await createOrRejoinSalesAgent(req, getSupabaseAdmin())
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }
    return jsonNoStore({ ok: false, error: 'unexpected' }, 500)
  }
}

export async function PATCH(req: Request) {
  try {
    if (!(await hasValidAdminSession())) {
      return jsonNoStore({ ok: false, error: 'unauthorized' }, 401)
    }

    mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
    mustGetEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!hasConfiguredSupabaseEnv()) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }

    return await deactivateSalesAgent(req, getSupabaseAdmin())
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return jsonNoStore({ ok: false, error: 'server_not_configured' }, 503)
    }
    return jsonNoStore({ ok: false, error: 'unexpected' }, 500)
  }
}
