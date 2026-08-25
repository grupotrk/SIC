import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Vence en 5 años — tenants de auditoría permanentes
const fechaVencimiento = new Date()
fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 5)
const vencimiento = fechaVencimiento.toISOString().slice(0, 10)

async function main() {
  const { data: userList } = await supabase.auth.admin.listUsers()
  const auditUsers = userList?.users?.filter(u => u.email?.startsWith('audit.') && u.email?.endsWith('@trikode.com.ar')) ?? []

  if (!auditUsers.length) {
    console.log('No se encontraron usuarios audit.*@trikode.com.ar')
    return
  }

  for (const authUser of auditUsers) {
    const tenantId = authUser.user_metadata?.tenant_id
    if (!tenantId) {
      console.log(`⏭️  ${authUser.email} — sin tenant_id, omitido`)
      continue
    }

    const { error } = await supabase
      .from('comercios')
      .update({
        estado_suscripcion: 'ACTIVO',
        suscripcion_vence_at: vencimiento,
        activo: true,
      })
      .eq('tenant_id', tenantId)

    console.log(error ? `❌ ${authUser.email} error: ${error.message}` : `✅ ${authUser.email} — suscripción activada`)
  }

  console.log('\nListo.')
}

main()
