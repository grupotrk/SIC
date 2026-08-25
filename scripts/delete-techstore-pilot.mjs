/**
 * Elimina Trikode Tech Store - Pilot de la BD.
 * Borra en orden: productos, actualizaciones_precios, ventas/detalles, turnos, cierres, usuarios auth, comercio.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'

const s = createClient(SUPABASE_URL, SERVICE_KEY)

const COMERCIO_ID = '79b38027-50e9-4242-92e2-97c9154fd76b'
const TENANT_ID   = '0279d07c-d865-4785-99ee-defbec0659dd'

async function step(nombre, fn) {
  const { error } = await fn()
  if (error) console.error(`  ✗ ${nombre}: ${error.message}`)
  else        console.log( `  ✓ ${nombre}`)
}

console.log('Eliminando Trikode Tech Store - Pilot...\n')

// 1. Tablas operativas del tenant
await step('actualizaciones_precios', () => s.from('actualizaciones_precios').delete().eq('tenant_id', TENANT_ID))
await step('venta_detalles',          () => s.from('venta_detalles').delete().eq('tenant_id', TENANT_ID))
await step('ventas',                  () => s.from('ventas').delete().eq('tenant_id', TENANT_ID))
await step('turnos',                  () => s.from('turnos').delete().eq('tenant_id', TENANT_ID))
await step('cierres_diarios',         () => s.from('cierres_diarios').delete().eq('tenant_id', TENANT_ID))
await step('productos_tienda',        () => s.from('productos_tienda').delete().eq('tenant_id', TENANT_ID))

// 2. Usuarios del comercio en comercio_usuarios
const { data: usuariosComercio } = await s.from('comercio_usuarios').select('auth_user_id').eq('comercio_id', COMERCIO_ID)
await step('comercio_usuarios', () => s.from('comercio_usuarios').delete().eq('comercio_id', COMERCIO_ID))

// 3. Eliminar usuarios auth
let authEliminados = 0
for (const { auth_user_id } of usuariosComercio ?? []) {
  const { error } = await s.auth.admin.deleteUser(auth_user_id)
  if (error) console.error(`  ✗ auth user ${auth_user_id}: ${error.message}`)
  else authEliminados++
}
console.log(`  ✓ ${authEliminados} usuarios auth eliminados`)

// 4. Comercio
await step('comercio', () => s.from('comercios').delete().eq('id', COMERCIO_ID))

console.log('\n✅ Listo.')
