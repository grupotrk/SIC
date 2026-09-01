import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || /relation .* does not exist/i.test(error.message || '')
    || /could not find the table/i.test(error.message || '')
}

export async function DELETE(req: Request) {
  if (!(await hasValidAdminSession())) return json({ ok: false, error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const tenantId = String(body?.tenant_id || '').trim()
  const confirmName = String(body?.confirm_name || '').trim()

  if (!tenantId || !confirmName) return json({ ok: false, error: 'invalid_fields' }, 400)

  const supabase = getSupabaseAdmin()

  const commerceRes = await supabase
    .from('comercios')
    .select('tenant_id,nombre,email')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (commerceRes.error) return json({ ok: false, error: 'commerce_lookup_failed' }, 500)
  if (!commerceRes.data) return json({ ok: false, error: 'commerce_not_found' }, 404)

  const commerce = commerceRes.data
  if (String(commerce.nombre || '').trim() !== confirmName) {
    return json({ ok: false, error: 'confirmation_mismatch' }, 400)
  }

  const protectedRes = await supabase
    .from('super_admin_users')
    .select('id')
    .eq('sandbox_tenant_id', tenantId)
    .eq('activo', true)
    .limit(1)

  if (!protectedRes.error && protectedRes.data?.length) {
    return json({ ok: false, error: 'protected_tenant' }, 409)
  }

  // Guardamos primero los Auth IDs: la eliminación de filas se hace antes que Auth para
  // que, si aparece una FK inesperada, podamos abortar sin dejar cuentas huérfanas.
  const membersRes = await supabase
    .from('comercio_usuarios')
    .select('auth_user_id')
    .eq('tenant_id', tenantId)

  if (membersRes.error) return json({ ok: false, error: 'member_lookup_failed' }, 500)

  const authUserIds = Array.from(new Set(
    (membersRes.data || [])
      .map((row) => String(row.auth_user_id || '').trim())
      .filter(Boolean)
  ))

  const deleteTenantRows = async (table: string) => {
    const result = await supabase.from(table).delete().eq('tenant_id', tenantId)
    if (result.error && !isMissingTableError(result.error)) {
      throw new Error(`${table}:${result.error.code || 'delete_failed'}`)
    }
  }

  try {
    // Hijos antes que padres para respetar las FK del esquema actual.
    for (const table of [
      'actualizaciones_precios',
      'cliente_feedback',
      'auditoria',
      'venta_detalles',
      'movimientos_stock',
      'cierres_diarios',
      'ventas',
      'turnos',
      'productos_tienda',
      'productos',
      'categorias',
      'productos_maestros',
      'comercio_usuarios',
    ]) {
      await deleteTenantRows(table)
    }

    const commerceDelete = await supabase.from('comercios').delete().eq('tenant_id', tenantId)
    if (commerceDelete.error) throw new Error(`comercios:${commerceDelete.error.code || 'delete_failed'}`)

    // El dashboard administrativo se alimenta de leads. Quitamos el alta correspondiente
    // para que el comercio eliminado tampoco siga apareciendo allí.
    const normalizedEmail = String(commerce.email || '').trim().toLowerCase()
    if (normalizedEmail) {
      const leadsRes = await supabase.from('leads').select('id').eq('email', normalizedEmail)
      if (!leadsRes.error && leadsRes.data?.length) {
        const leadIds = leadsRes.data.map((row) => row.id)
        const notifDelete = await supabase.from('notificacion_logs').delete().in('lead_id', leadIds)
        if (notifDelete.error && !isMissingTableError(notifDelete.error)) {
          throw new Error(`notificacion_logs:${notifDelete.error.code || 'delete_failed'}`)
        }
        const leadsDelete = await supabase.from('leads').delete().in('id', leadIds)
        if (leadsDelete.error) throw new Error(`leads:${leadsDelete.error.code || 'delete_failed'}`)
      }
    }
  } catch (error) {
    console.error('Permanent tenant deletion failed before Auth cleanup', { tenantId, error })
    return json({ ok: false, error: 'tenant_delete_failed' }, 500)
  }

  // Auth va al final: así el mismo email vuelve a quedar disponible para futuras pruebas.
  const authErrors: string[] = []
  for (const userId of authUserIds) {
    const result = await supabase.auth.admin.deleteUser(userId)
    if (result.error) {
      authErrors.push(userId)
      console.error('Auth user deletion failed after tenant cleanup', { tenantId, userId, error: result.error.message })
    }
  }

  if (authErrors.length > 0) {
    return json({ ok: false, error: 'auth_delete_failed', auth_users_pending: authErrors.length }, 500)
  }

  return json({ ok: true, tenant_id: tenantId, auth_users_deleted: authUserIds.length })
}
