import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { data: userList } = await supabase.auth.admin.listUsers()
  const auditUsers = userList?.users?.filter(u => u.email?.startsWith('audit.') && u.email?.endsWith('@trikode.com.ar')) ?? []

  if (!auditUsers.length) {
    console.log('No se encontraron usuarios audit.*@trikode.com.ar')
    return
  }

  const issues = []

  for (const authUser of auditUsers) {
    const email = authUser.email
    const tenantId = authUser.user_metadata?.tenant_id
    const row = { email, tenantId: tenantId ?? '❌ AUSENTE', comercio: '', cuRol: '', suscripcion: '', problemas: [] }

    if (!tenantId) {
      row.problemas.push('Sin tenant_id en metadata')
      issues.push(row)
      continue
    }

    const [{ data: comercio }, { data: cu }] = await Promise.all([
      supabase.from('comercios').select('nombre,activo,estado_suscripcion,suscripcion_vence_at').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('comercio_usuarios').select('rol,activo').eq('tenant_id', tenantId).eq('auth_user_id', authUser.id).maybeSingle(),
    ])

    row.comercio = comercio ? `${comercio.nombre} (activo=${comercio.activo})` : '❌ NO ENCONTRADO'
    row.cuRol = cu ? `${cu.rol} activo=${cu.activo}` : '❌ NO ENCONTRADO'
    row.suscripcion = comercio ? `${comercio.estado_suscripcion ?? 'null'} | vence=${comercio.suscripcion_vence_at ?? 'null'}` : '—'

    if (!comercio) row.problemas.push('Sin comercio')
    else if (!comercio.activo) row.problemas.push('Comercio inactivo')
    else if (!comercio.estado_suscripcion || comercio.estado_suscripcion !== 'ACTIVO') row.problemas.push(`Suscripción: ${comercio.estado_suscripcion ?? 'null'}`)

    if (!cu) row.problemas.push('Sin comercio_usuarios')
    else if (!cu.activo) row.problemas.push('Usuario inactivo')
    else if (cu.rol !== 'OWNER') row.problemas.push(`Rol incorrecto: ${cu.rol}`)

    issues.push(row)
  }

  console.log('\n========== ESTADO DE TENANTS DE AUDITORÍA ==========')
  for (const r of issues) {
    const status = r.problemas.length === 0 ? '✅ OK' : `⚠️  PROBLEMAS: ${r.problemas.join(', ')}`
    console.log(`\n${r.email}`)
    console.log(`  tenant_id   : ${r.tenantId}`)
    console.log(`  comercio    : ${r.comercio}`)
    console.log(`  cu_rol      : ${r.cuRol}`)
    console.log(`  suscripcion : ${r.suscripcion}`)
    console.log(`  ${status}`)
  }

  const conProblemas = issues.filter(r => r.problemas.length > 0)
  console.log(`\n========== RESUMEN: ${issues.length} tenants, ${conProblemas.length} con problemas ==========`)
}

main()
