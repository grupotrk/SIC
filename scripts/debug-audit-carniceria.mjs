import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const email = 'audit.carniceria@trikode.com.ar'

  // 1. Auth user
  const { data: userList } = await supabase.auth.admin.listUsers()
  const authUser = userList?.users?.find(u => u.email === email)
  if (!authUser) {
    console.log('❌ Auth user NO encontrado')
    return
  }
  console.log('✅ Auth user:', authUser.id)
  console.log('   metadata:', JSON.stringify(authUser.user_metadata))

  const tenantId = authUser.user_metadata?.tenant_id
  if (!tenantId) {
    console.log('❌ tenant_id AUSENTE en metadata')
    return
  }

  // 2. Comercio
  const { data: comercio } = await supabase
    .from('comercios')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!comercio) {
    console.log('❌ Comercio NO encontrado para tenant_id:', tenantId)
    return
  }
  console.log('✅ Comercio:', comercio.nombre, '| activo:', comercio.activo)

  // 3. comercio_usuarios
  const { data: cu } = await supabase
    .from('comercio_usuarios')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (!cu) {
    console.log('❌ comercio_usuarios NO encontrado')
  } else {
    console.log('✅ comercio_usuarios: rol=' + cu.rol + ' activo=' + cu.activo)
  }

  // 4. Suscripción
  const { data: subs } = await supabase
    .from('suscripciones')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!subs) {
    console.log('❌ Suscripción: NO EXISTE')
  } else {
    console.log('✅ Suscripción:', JSON.stringify(subs))
  }
}

main()
