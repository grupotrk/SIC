import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const AUDIT_EMAIL = 'test@trikode.com.ar'

async function main() {
  // Buscar todos los tenants de auditoría
  const { data: tenants, error } = await supabase
    .from('comercios')
    .select('tenant_id, nombre, activo, estado_suscripcion, suscripcion_vence_at, depurado_at')
    .eq('email', AUDIT_EMAIL)

  if (error) { console.error('Error:', error); process.exit(1) }

  console.log(`Tenants encontrados: ${tenants.length}`)
  for (const t of tenants) {
    console.log(`  ${t.nombre} | activo=${t.activo} | estado=${t.estado_suscripcion} | depurado=${t.depurado_at}`)
  }

  // Corregir todos: activo=true, estado=activo, limpiar depurado_at y vencimiento
  const { error: updateError } = await supabase
    .from('comercios')
    .update({
      activo: true,
      estado_suscripcion: 'activo',
      suscripcion_vence_at: null,
      solo_descarga_hasta: null,
      depurado_at: null,
      baja_solicitada_at: null,
    })
    .eq('email', AUDIT_EMAIL)

  if (updateError) {
    console.error('Error actualizando:', updateError)
    process.exit(1)
  }

  console.log('\nTodos los tenants de auditoría corregidos a estado ACTIVO.')
}

main()
