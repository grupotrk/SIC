/**
 * Crea Juan Ferrero (juancferrero, juancferrero1...) como empleado
 * en los 7 tenants audit que no tienen empleado.
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

const NOMBRE   = 'Juan Ferrero'

// Tenants sin empleado (tenant_id del comercio, no comercios.id)
const TENANTS = [
  { tenantId: '28861dc4-003c-438a-aa57-c8458928de9e', nombre: 'Auditoría Carnicería/Verdulería' },
  { tenantId: '37f58dfa-dd5a-4df8-a5a6-e169ecfc59ff', nombre: 'Auditoría Ferretería'            },
  { tenantId: '97cd3108-0019-4cab-9bee-fe63af5aa1fc', nombre: 'Auditoría Librería'              },
  { tenantId: '778b2fbe-c283-4e52-9403-70b46f145f4e', nombre: 'Auditoría Química'               },
  { tenantId: 'c67d86b6-3d1e-4c3e-a7c2-1ea1af573b21', nombre: 'Auditoría Rotisería'             },
  { tenantId: '39489d28-e1f2-4c1f-a5a3-8de7e3432bfe', nombre: 'Auditoría Rotisería/Carrito'     },
  { tenantId: 'ea1311a4-6b59-4b1d-8e9b-6fd672ea1445', nombre: 'Auditoría Tienda de Mascotas'    },
]

for (let i = 0; i < TENANTS.length; i++) {
  const { tenantId, nombre } = TENANTS[i]
  const username = i === 0 ? 'juancferrero' : `juancferrero${i}`
  const email    = `${username}.${tenantId.slice(0, 8)}@trikode.local`

  // 1. Crear usuario en auth
  const { data: authData, error: authErr } = await s.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      email_verified: true,
      nombre: NOMBRE,
      rol: 'EMPLOYEE',
      tenant_id: tenantId,
    },
  })

  if (authErr) {
    console.error(`✗ ${nombre} [${username}]: auth error — ${authErr.message}`)
    continue
  }

  // 2. Insertar en comercio_usuarios
  const { error: cuErr } = await s.from('comercio_usuarios').insert({
    tenant_id:    tenantId,
    auth_user_id: authData.user.id,
    nombre:       NOMBRE,
    email,
    rol:          'EMPLOYEE',
    activo:       true,
    metadata:     { login_username: username },
  })

  if (cuErr) {
    // Si falla la inserción, limpiar auth para no dejar huérfanos
    await s.auth.admin.deleteUser(authData.user.id)
    console.error(`✗ ${nombre} [${username}]: comercio_usuarios error — ${cuErr.message}`)
    continue
  }

  console.log(`✓ ${nombre}  →  usuario: ${username}  |  email: ${email}`)
}

console.log('\n✅ Listo.')
