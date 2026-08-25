import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  console.log('Buscando employees sin tenant_id en metadata...')

  // Obtener todos los employees
  const { data: employees, error } = await supabase
    .from('comercio_usuarios')
    .select('id, tenant_id, auth_user_id, nombre, email, metadata')
    .eq('rol', 'EMPLOYEE')
    .eq('activo', true)

  if (error) {
    console.error('Error consultando comercio_usuarios:', error)
    process.exit(1)
  }

  console.log(`Employees encontrados: ${employees.length}`)

  let fixed = 0
  let skipped = 0

  for (const emp of employees) {
    // Obtener user_metadata actual desde Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(emp.auth_user_id)
    if (authError || !authUser?.user) {
      console.log(`  SKIP ${emp.nombre} (${emp.email}): no se encontró en Auth`)
      skipped++
      continue
    }

    const currentMeta = authUser.user.user_metadata || {}
    if (currentMeta.tenant_id) {
      console.log(`  OK ${emp.nombre} (${emp.email}): ya tiene tenant_id=${currentMeta.tenant_id}`)
      skipped++
      continue
    }

    // Actualizar con el tenant_id correcto
    const { error: updateError } = await supabase.auth.admin.updateUserById(emp.auth_user_id, {
      user_metadata: {
        ...currentMeta,
        tenant_id: emp.tenant_id,
      }
    })

    if (updateError) {
      console.log(`  ERROR ${emp.nombre} (${emp.email}):`, updateError.message)
    } else {
      console.log(`  FIXED ${emp.nombre} (${emp.email}): tenant_id=${emp.tenant_id}`)
      fixed++
    }
  }

  console.log(`\nResultado: ${fixed} corregidos, ${skipped} omitidos.`)
}

main()
