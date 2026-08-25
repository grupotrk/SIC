/**
 * Agrega juancferrero7 y juancferrero8 en Carnicería y Kioscos
 * (que ya tenían otro empleado, pero igual necesitan a Juan Ferrero)
 */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_JUANFERRERO_PASS

if (!SUPABASE_URL) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL en .env')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en .env')
if (!PASSWORD) throw new Error('Falta SEED_JUANFERRERO_PASS en .env')

const s = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const NOMBRE = 'Juan Ferrero'

const TENANTS = [
  { tenantId: '68856a35-f406-4b5a-ae1e-eae256e75b9c', nombre: 'Auditoría Carnicería', username: 'juancferrero7' },
  { tenantId: '7c32ba40-6f5f-45f1-b80d-8e1f31c1f221', nombre: 'Auditoría Kioscos',    username: 'juancferrero8' },
]

for (const { tenantId, nombre, username } of TENANTS) {
  const email = `${username}.${tenantId.slice(0, 8)}@trikode.local`

  const { data: authData, error: authErr } = await s.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { email_verified: true, nombre: NOMBRE, rol: 'EMPLOYEE', tenant_id: tenantId },
  })

  if (authErr) {
    console.error(`✗ ${nombre} [${username}]: ${authErr.message}`)
    continue
  }

  const { error: cuErr } = await s.from('comercio_usuarios').insert({
    tenant_id: tenantId, auth_user_id: authData.user.id,
    nombre: NOMBRE, email, rol: 'EMPLOYEE', activo: true,
    metadata: { login_username: username },
  })

  if (cuErr) {
    await s.auth.admin.deleteUser(authData.user.id)
    console.error(`✗ ${nombre} [${username}]: ${cuErr.message}`)
    continue
  }

  console.log(`✓ ${nombre}  →  ${username}`)
}

console.log('\n✅ Listo.')
