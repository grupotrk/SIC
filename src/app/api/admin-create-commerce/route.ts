import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USER_RE = /^[a-zA-Z0-9]{3,40}$/

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  if (!(await hasValidAdminSession())) return json({ ok: false, error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return json({ ok: false, error: 'invalid_json' }, 400)

  const nombre = String(body.nombre_comercio || '').trim().slice(0, 100)
  const rubro = String(body.rubro || '').trim().slice(0, 100)
  const whatsapp = String(body.whatsapp || '').trim().slice(0, 20)
  const email = String(body.email || '').trim().toLowerCase().slice(0, 100)
  const ownerNombre = String(body.owner_nombre || '').trim().slice(0, 100)
  const ownerUsername = String(body.owner_username || '').trim().toLowerCase()
  const ownerPassword = String(body.owner_password || '')
  const trialDays = Math.max(0, Math.min(90, Number(body.trial_days ?? 7) || 0))

  if (!nombre || !rubro || !whatsapp || !ownerNombre || !EMAIL_RE.test(email) || !USER_RE.test(ownerUsername)) {
    return json({ ok: false, error: 'invalid_fields' }, 400)
  }
  if (ownerPassword.length < 8 || !/[a-zA-Z]/.test(ownerPassword) || !/[0-9]/.test(ownerPassword)) {
    return json({ ok: false, error: 'invalid_password' }, 400)
  }

  const supabase = getSupabaseAdmin()

  const emailCheck = await supabase.from('comercios').select('tenant_id').eq('email', email).limit(1)
  if (emailCheck.data?.length) return json({ ok: false, error: 'email_exists' }, 409)

  const usernameCheck = await supabase.from('comercio_usuarios').select('id').eq('rol', 'OWNER').eq('activo', true).eq('metadata->>login_username', ownerUsername).limit(1)
  if (usernameCheck.data?.length) return json({ ok: false, error: 'username_exists' }, 409)

  const { data: rubros, error: rubroErr } = await supabase.from('rubros').select('id,nombre')
  if (rubroErr) return json({ ok: false, error: 'rubro_lookup_failed' }, 500)
  const rubroRow = rubros?.find(r => String(r.nombre).toLowerCase() === rubro.toLowerCase())
    || rubros?.find(r => String(r.nombre).toLowerCase().startsWith(rubro.toLowerCase().slice(0, 4)))
  if (!rubroRow?.id) return json({ ok: false, error: 'rubro_not_found' }, 400)

  const { data: plan } = await supabase.from('planes').select('id').order('precio', { ascending: false }).limit(1).maybeSingle()
  if (!plan?.id) return json({ ok: false, error: 'plan_not_found' }, 500)

  const { data: tenantId, error: tenantErr } = await supabase.rpc('registrar_comercio', {
    p_nombre: nombre,
    p_email: email,
    p_telefono: whatsapp,
    p_direccion: 'A definir',
    p_rubro_id: rubroRow.id,
    p_plan_id: plan.id,
  })
  if (tenantErr || !tenantId) return json({ ok: false, error: 'tenant_provision_failed' }, 500)

  const trialEnd = new Date()
  trialEnd.setUTCDate(trialEnd.getUTCDate() + trialDays)
  const graceEnd = new Date(trialEnd); graceEnd.setUTCDate(graceEnd.getUTCDate() + 7)
  const downloadEnd = new Date(trialEnd); downloadEnd.setUTCDate(downloadEnd.getUTCDate() + Number(process.env.SUBSCRIPTION_DOWNLOAD_DAYS || 120))

  await supabase.from('comercios').update({
    estado_suscripcion: trialDays > 0 ? 'TRIAL' : 'ACTIVO',
    suscripcion_vence_at: trialEnd.toISOString().slice(0, 10),
    gracia_hasta: graceEnd.toISOString().slice(0, 10),
    solo_descarga_hasta: downloadEnd.toISOString().slice(0, 10),
    activo: true,
    metadata: { provisioned_via: 'admin_manual', owner_username: ownerUsername },
  }).eq('tenant_id', tenantId)

  const authRes = await supabase.auth.admin.createUser({
    email,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: { nombre: ownerNombre, rol: 'OWNER', tenant_id: tenantId },
  })

  if (authRes.error || !authRes.data.user?.id) {
    await supabase.from('comercios').delete().eq('tenant_id', tenantId)
    return json({ ok: false, error: authRes.error?.message?.toLowerCase().includes('already') ? 'email_exists' : 'auth_create_failed' }, 409)
  }

  const authUserId = authRes.data.user.id
  const memberRes = await supabase.from('comercio_usuarios').insert({
    tenant_id: tenantId,
    auth_user_id: authUserId,
    nombre: ownerNombre,
    email,
    rol: 'OWNER',
    activo: true,
    metadata: { login_username: ownerUsername, provisioned_via: 'admin_manual' },
  })

  if (memberRes.error) {
    await supabase.auth.admin.deleteUser(authUserId)
    await supabase.from('comercios').delete().eq('tenant_id', tenantId)
    return json({ ok: false, error: 'owner_link_failed' }, 500)
  }

  // Mantiene el comercio visible en el dashboard administrativo, que hoy se alimenta de leads.
  await supabase.from('leads').insert({
    nombre_comercio: nombre,
    rubro,
    whatsapp,
    email,
    plan: 'Completo',
    plan_precio: Number(process.env.SUBSCRIPTION_PRICE || 40000),
    estado: trialDays > 0 ? 'TRIAL_ACTIVO' : 'PAGADO',
    accepted_terms: false,
    mensaje: 'Alta manual desde panel administrativo',
  })

  return json({ ok: true, tenant_id: tenantId, owner_username: ownerUsername, email, trial_days: trialDays })
}
