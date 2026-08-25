import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const AUDIT_EMAIL = 'test@trikode.com.ar'

async function main() {
  // Buscar todos los tenants de auditoría por el email del owner
  const { data: comercios, error } = await supabase
    .from('comercios')
    .select('id, tenant_id, nombre, activo, estado_suscripcion, depurado_at, suscripcion_vence_at')
    .eq('email', AUDIT_EMAIL)

  if (error) {
    console.error('Error buscando comercios:', error)
    process.exit(1)
  }

  if (!comercios || comercios.length === 0) {
    console.log('No se encontraron comercios con email', AUDIT_EMAIL)
    // Buscar por tenant_id directo
    const { data: byTenant, error: e2 } = await supabase
      .from('comercios')
      .select('id, tenant_id, nombre, activo, estado_suscripcion, depurado_at, suscripcion_vence_at')
      .eq('tenant_id', '0279d07c-d865-4785-99ee-defbec0659dd')
    console.log('Por tenant_id:', byTenant, e2)
    
    // Buscar en comercio_usuarios para encontrar los tenant_ids de auditoría
    const { data: cuRows, error: e3 } = await supabase
      .from('comercio_usuarios')
      .select('tenant_id')
      .eq('auth_user_id', (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === AUDIT_EMAIL)?.id || '')
      .eq('rol', 'OWNER')
    console.log('Tenant IDs desde comercio_usuarios:', cuRows, e3)
    return
  }

  console.log(`Encontrados ${comercios.length} tenants de auditoría`)

  for (const comercio of comercios) {
    console.log(`\nTenant: ${comercio.nombre} (${comercio.tenant_id})`)
    console.log(`  activo=${comercio.activo}, estado=${comercio.estado_suscripcion}, depurado_at=${comercio.depurado_at}`)

    const { error: updateError } = await supabase
      .from('comercios')
      .update({
        activo: true,
        depurado_at: null,
        estado_suscripcion: 'ACTIVO',
        suscripcion_vence_at: null,
      })
      .eq('tenant_id', comercio.tenant_id)

    if (updateError) {
      console.log(`  ERROR:`, updateError.message)
    } else {
      console.log(`  FIXED: activo=true, depurado_at=null, estado=ACTIVO`)
    }
  }
}

main()
