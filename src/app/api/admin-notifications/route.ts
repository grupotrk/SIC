import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

export async function GET() {
  try {
    if (!(await hasValidAdminSession())) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
      )
    }

    const supabase = getSupabaseAdmin()

    // Últimos 200 logs de notificaciones
    const { data: logs, error } = await supabase
      .from('notificacion_logs')
      .select('id,lead_id,tipo,motivo,enviado,error_message,created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json(
        { ok: false, error: 'db_error' },
        { status: 500, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
      )
    }

    // Enriquecer con nombre del comercio desde leads
    const leadIds = [...new Set((logs || []).map((l) => l.lead_id).filter(Boolean))]

    const namesByLead: Record<string, string> = {}
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id,nombre_comercio,email')
        .in('id', leadIds)

      if (leads) {
        for (const lead of leads) {
          namesByLead[String(lead.id)] =
            String(lead.nombre_comercio || lead.email || lead.id || '').trim() || '—'
        }
      }
    }

    const enriched = (logs || []).map((log) => ({
      ...log,
      nombre_comercio: namesByLead[String(log.lead_id || '')] ?? null,
    }))

    return NextResponse.json(
      { ok: true, logs: enriched },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
    )
  } catch {
    return NextResponse.json(
      { ok: false, error: 'unexpected' },
      { status: 500, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
    )
  }
}
