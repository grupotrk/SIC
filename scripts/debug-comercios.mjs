import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Ver qué tenants existen y cómo se llaman
  const { data, error } = await supabase
    .from('comercios')
    .select('tenant_id, nombre, email, activo, metadata')
    .order('nombre')

  console.log('Todos los comercios:')
  console.log(JSON.stringify(data, null, 2))
  if (error) console.error(error)
}

main()
