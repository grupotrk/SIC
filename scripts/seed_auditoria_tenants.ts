import dotenv from 'dotenv'
import { resolve } from 'path'
dotenv.config({ path: resolve(process.cwd(), '.env') })
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true })
import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const ADMIN_PASS = process.env.SEED_AUDIT_PASS || process.env.SEED_ADMIN_PASS || ''
if (!ADMIN_PASS) throw new Error('Falta SEED_AUDIT_PASS en .env.local')

// Cada rubro tiene su propio email de auditoría para evitar el UNIQUE constraint de comercios.
// El owner (test@trikode.com.ar) es el mismo usuario Auth para todos, pero el email
// del comercio es distinto por rubro.
const RUBROS: Array<{ nombre: string; emailSlug: string }> = [
  { nombre: 'Kioscos',               emailSlug: 'kioscos' },
  { nombre: 'Rotisería',             emailSlug: 'rotiseria' },
  { nombre: 'Rotisería/Carrito',     emailSlug: 'rotiseria-carrito' },
  { nombre: 'Química',               emailSlug: 'quimica' },
  { nombre: 'Carnicería',            emailSlug: 'carniceria' },
  { nombre: 'Carnicería/Verdulería', emailSlug: 'carniceria-verduleria' },
  { nombre: 'Ferretería',            emailSlug: 'ferreteria' },
  { nombre: 'Tienda de Mascotas',    emailSlug: 'mascotas' },
  { nombre: 'Librería',              emailSlug: 'libreria' },
]

// Email del usuario Auth principal (el que hace login como OWNER)
const OWNER_AUTH_EMAIL = process.env.SEED_ADMIN_EMAIL || 'test@trikode.com.ar'

// Genera el email del comercio para cada rubro (debe ser único en la tabla comercios)
function rubroEmail(slug: string): string {
  return `audit.${slug}@sic.local`
}

async function getOrCreateAuthUser(email: string): Promise<string> {
  const { data: userList } = await supabase.auth.admin.listUsers()
  const found = userList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (found) return found.id

  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email,
    password:      ADMIN_PASS,
    email_confirm: true,
  })
  if (error || !newUser?.user?.id) throw new Error(`No se pudo crear el usuario Auth ${email}: ${error?.message}`)
  return newUser.user.id
}

async function main() {
  console.log('🌱 Seed de tenants de auditoría\n')
  console.log('  Cada rubro tiene su propio usuario Auth (mismo pass, distinto email)\n')

  for (const rubro of RUBROS) {
    // El email del comercio y del usuario Auth son el mismo por rubro
    const authEmail = rubroEmail(rubro.emailSlug)
    console.log(`📦 ${rubro.nombre}`)
    console.log(`   Login: ${authEmail} / ${ADMIN_PASS}`)

    // Buscar rubro_id
    const { data: rubroRow, error: rubroError } = await supabase
      .from('rubros')
      .select('id')
      .eq('nombre', rubro.nombre)
      .maybeSingle()
    if (rubroError || !rubroRow) {
      console.log(`  ⚠️  Rubro no encontrado en la tabla: "${rubro.nombre}" — saltando`)
      continue
    }
    const rubro_id = rubroRow.id

    // Buscar o crear usuario Auth para este rubro
    let userId: string
    try {
      userId = await getOrCreateAuthUser(authEmail)
      console.log(`  ✓ Usuario Auth listo`)
    } catch (err) {
      console.log(`  ❌ ${err instanceof Error ? err.message : err}`)
      continue
    }

    // Buscar o crear el comercio
    const { data: existing } = await supabase
      .from('comercios')
      .select('id, tenant_id')
      .eq('email', authEmail)
      .maybeSingle()

    let tenantId: string

    if (existing?.tenant_id) {
      tenantId = existing.tenant_id
      console.log(`  ✓ Comercio ya existe`)
    } else {
      const { data: tenant, error: tenantError } = await supabase
        .from('comercios')
        .insert({
          nombre:   `Auditoría ${rubro.nombre}`,
          email:    authEmail,
          rubro_id,
          activo:   true,
          metadata: { auditoria: true },
        })
        .select('id, tenant_id')
        .single()

      if (tenantError || !tenant) {
        console.log(`  ❌ Error creando comercio: ${tenantError?.message}`)
        continue
      }
      tenantId = tenant.tenant_id
      console.log(`  ✓ Comercio creado`)
    }

    // Vincular el usuario como OWNER (upsert — si ya existe no rompe)
    const { error: ownerError } = await supabase
      .from('comercio_usuarios')
      .upsert({
        tenant_id:    tenantId,
        auth_user_id: userId,
        nombre:       `Dueño Demo ${rubro.nombre}`,
        email:        authEmail,
        rol:          'OWNER',
        activo:       true,
        metadata:     { auditoria: true, seed: 'audit_demo' },
      }, { onConflict: 'tenant_id,email' })

    if (ownerError) {
      console.log(`  ❌ Error vinculando OWNER: ${ownerError.message}`)
    } else {
      console.log(`  ✓ OWNER vinculado`)
    }

    console.log()
  }

  console.log('✅ ¡Tenants de auditoría listos!\n')
  console.log('  Credenciales (todas con la misma contraseña):')
  for (const rubro of RUBROS) {
    console.log(`  ${rubro.nombre.padEnd(25)} →  ${rubroEmail(rubro.emailSlug)}`)
  }
  console.log(`\n  Contraseña: ${ADMIN_PASS}\n`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})