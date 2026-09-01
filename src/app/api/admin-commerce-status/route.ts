import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(req: Request) {
  if (!(await hasValidAdminSession())) return json({ ok: false, error: 'unauthorized' }, 401)

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const tenantId = String(body?.tenant_id || '').trim()
  const active = body?.active

  if (!tenantId || typeof active !== 'boolean') return json({ ok: false, error: 'invalid_fields' }, 400)

  const supabase = getSupabaseAdmin()
  const existing = await supabase.from('comercios').select('tenant_id,nombre,activo').eq('tenant_id', tenantId).maybeSingle()
  if (existing.error) return json({ ok: false, error: 'commerce_lookup_failed' }, 500)
  if (!existing.data) return json({ ok: false, error: 'commerce_not_found' }, 404)

  const updated = await supabase
    .from('comercios')
    .update({ activo: active, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)

  if (updated.error) return json({ ok: false, error: 'commerce_update_failed' }, 500)

  return json({ ok: true, tenant_id: tenantId, active })
}
