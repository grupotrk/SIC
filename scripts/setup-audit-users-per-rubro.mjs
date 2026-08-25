import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const AUDIT_PASS = process.env.SEED_AUDIT_PASS

if (!SUPABASE_URL) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL en .env')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en .env')
if (!AUDIT_PASS) throw new Error('Falta SEED_AUDIT_PASS en .env')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function rubroToSlug(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

async function main() {
  // Obtener todos los rubros
  const { data: rubros, error: rubrosError } = await supabase
    .from('rubros')
    .select('id, nombre')
    .order('nombre')

  if (rubrosError || !rubros?.length) {
    console.error('No se encontraron rubros:', rubrosError)
    process.exit(1)
  }

  console.log(`Rubros encontrados: ${rubros.length}\n`)

  const { data: userList } = await supabase.auth.admin.listUsers()
  const resultados = []

  for (const rubro of rubros) {
    const slug = rubroToSlug(rubro.nombre)
    const auditEmail = `audit.${slug}@trikode.com.ar`
    const comercioNombre = `Auditoría ${rubro.nombre}`

    console.log(`--- ${rubro.nombre} ---`)

    // 1. Buscar o crear comercio (tenant)
    let tenantId
    const { data: existComercio } = await supabase
      .from('comercios')
      .select('tenant_id')
      .eq('nombre', comercioNombre)
      .maybeSingle()

    if (existComercio) {
      tenantId = existComercio.tenant_id
      console.log(`  Comercio existente: ${tenantId}`)
    } else {
      const { data: newComercio, error: cErr } = await supabase
        .from('comercios')
        .insert({
          nombre: comercioNombre,
          email: auditEmail,
          rubro_id: rubro.id,
          activo: true,
          metadata: { auditoria: true },
        })
        .select('tenant_id')
        .single()

      if (cErr || !newComercio) {
        console.log(`  ERROR creando comercio:`, cErr?.message)
        continue
      }
      tenantId = newComercio.tenant_id
      console.log(`  Comercio creado: ${tenantId}`)
    }

    // 2. Buscar o crear auth user
    let authUser = userList?.users?.find(u => u.email === auditEmail)

    if (authUser) {
      console.log(`  Auth user existente: ${authUser.id}`)
      await supabase.auth.admin.updateUserById(authUser.id, {
        user_metadata: { tenant_id: tenantId, rol: 'OWNER' }
      })
      console.log(`  Metadata actualizada`)
    } else {
      const { data: newUser, error: uErr } = await supabase.auth.admin.createUser({
        email: auditEmail,
        password: AUDIT_PASS,
        email_confirm: true,
        user_metadata: { tenant_id: tenantId, rol: 'OWNER' }
      })
      if (uErr || !newUser?.user) {
        console.log(`  ERROR creando auth user:`, uErr?.message)
        continue
      }
      authUser = newUser.user
      console.log(`  Auth user creado: ${authUser.id}`)
    }

    // 3. Upsert comercio_usuarios OWNER
    const { error: cuErr } = await supabase
      .from('comercio_usuarios')
      .upsert({
        tenant_id: tenantId,
        auth_user_id: authUser.id,
        nombre: `Auditor ${rubro.nombre}`,
        email: auditEmail,
        rol: 'OWNER',
        activo: true,
        metadata: { auditoria: true },
      }, { onConflict: 'tenant_id,email' })

    if (cuErr) {
      console.log(`  ERROR en comercio_usuarios:`, cuErr.message)
    } else {
      console.log(`  comercio_usuarios OK`)
    }

    resultados.push({ rubro: rubro.nombre, email: auditEmail, password: AUDIT_PASS })
    console.log()
  }

  console.log('\n========== CREDENCIALES DE AUDITORÍA ==========')
  for (const r of resultados) {
    console.log(`${r.rubro.padEnd(25)} | ${r.email.padEnd(42)} | ${r.password}`)
  }
  console.log('================================================')
}

main()
