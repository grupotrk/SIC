/**
 * seed_audit_demo.ts
 * ------------------
 * Seed de simulación realista para los tenants de auditoría.
 * Para cada rubro:
 *   1. Importa el catálogo de productos completo
 *   2. Crea un empleado ficticio de demo
 *   3. Genera 20 ventas históricas cerradas (3 turnos en 3 días distintos)
 *
 * Idempotente: puede correrse múltiples veces sin duplicar datos.
 * Uso: npx tsx scripts/seed_audit_demo.ts
 */

import dotenv from 'dotenv'
import { resolve } from 'path'
dotenv.config({ path: resolve(process.cwd(), '.env') })
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true })
import { createClient } from '@supabase/supabase-js'
import { findCatalogoByRubro } from '../src/lib/catalogoTemplates'

// ─── Supabase ───────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'test@trikode.com.ar'
const DEMO_PIN = process.env.SEED_AUDIT_PASS || ''
if (!DEMO_PIN) throw new Error('Falta SEED_AUDIT_PASS para el PIN del empleado demo')

// ─── Empleados ficticios por rubro ──────────────────────────────────────────

const EMPLEADOS_DEMO: Record<string, { nombre: string; username: string }> = {
  'Kioscos':               { nombre: 'María González',  username: 'kioscos_demo' },
  'Rotisería':             { nombre: 'Carlos Romero',   username: 'rotiseria_demo' },
  'Rotisería/Carrito':     { nombre: 'Luis Fernández',  username: 'rotiseriacarrito_demo' },
  'Química':               { nombre: 'Ana Martínez',    username: 'quimica_demo' },
  'Carnicería':            { nombre: 'Roberto Díaz',    username: 'carniceria_demo' },
  'Carnicería/Verdulería': { nombre: 'Silvia López',    username: 'carniceriaverduleria_demo' },
  'Ferretería':            { nombre: 'Jorge García',    username: 'ferreteria_demo' },
  'Tienda de Mascotas':    { nombre: 'Laura Torres',    username: 'mascotas_demo' },
  'Librería':              { nombre: 'Pablo Morales',   username: 'libreria_demo' },
}

// Métodos de pago con pesos de distribución realista
const METODOS_PAGO = [
  { metodo: 'EFECTIVO',      peso: 5 },
  { metodo: 'TARJETA',       peso: 3 },
  { metodo: 'TRANSFERENCIA', peso: 2 },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomPago(): string {
  const total = METODOS_PAGO.reduce((s, m) => s + m.peso, 0)
  let r = Math.random() * total
  for (const m of METODOS_PAGO) {
    r -= m.peso
    if (r <= 0) return m.metodo
  }
  return 'EFECTIVO'
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals = 3): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function diasAtras(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function horaLaboral(base: Date, offsetMinutes: number): Date {
  const d = new Date(base)
  d.setHours(9, 0, 0, 0)
  d.setMinutes(d.getMinutes() + offsetMinutes)
  return d
}

// ─── Paso 1: Productos ───────────────────────────────────────────────────────

async function seedProductos(tenantId: string, rubroNombre: string): Promise<string[]> {
  const catalogo = findCatalogoByRubro(rubroNombre)
  if (!catalogo) {
    console.log(`  ⚠️  Sin catálogo para rubro "${rubroNombre}" — saltando productos`)
    return []
  }

  const { count } = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('activo', true)

  if ((count ?? 0) > 0) {
    console.log(`  ✓ Productos ya existentes (${count}) — saltando importación`)
    const { data } = await supabase
      .from('productos')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('activo', true)
    return (data ?? []).map(p => p.id as string)
  }

  const rows = catalogo.productos.map(prod => ({
    tenant_id:        tenantId,
    nombre:           prod.nombre,
    categoria_id:     null,
    precio_venta:     prod.precio_venta,
    precio_costo:     prod.precio_costo,
    unidad_medida:    prod.unidad_medida.toUpperCase(),
    permite_fraccion: prod.permite_fraccion,
    stock_actual:     randomInt(10, 80),
    stock_minimo:     5,
    activo:           true,
    metadata:         { auditoria: true, seed: 'audit_demo' },
  }))

  const { data: inserted, error } = await supabase
    .from('productos')
    .insert(rows)
    .select('id')

  if (error) throw new Error(`Error insertando productos: ${error.message}`)
  console.log(`  ✓ ${inserted?.length ?? 0} productos importados (${catalogo.rubroNombre})`)
  return (inserted ?? []).map(p => p.id as string)
}

// ─── Paso 2: Empleado demo ───────────────────────────────────────────────────

async function seedEmpleadoDemo(
  tenantId: string,
  rubroNombre: string
): Promise<{ empleadoId: string }> {
  const info = EMPLEADOS_DEMO[rubroNombre]
  if (!info) throw new Error(`Sin datos de empleado demo para rubro "${rubroNombre}"`)

  const demoEmail = `demo.${info.username}@sic.local`

  // 1. Buscar o crear usuario Auth
  const { data: userList } = await supabase.auth.admin.listUsers()
  let authUserId: string | null = null
  const found = userList?.users?.find(u => u.email?.toLowerCase() === demoEmail.toLowerCase())

  if (found) {
    authUserId = found.id
  } else {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email:         demoEmail,
      password:      DEMO_PIN,
      email_confirm: true,
    })
    if (error || !newUser?.user?.id) throw new Error(`Error creando auth user demo: ${error?.message}`)
    authUserId = newUser.user.id
  }

  // 2. Buscar comercio_usuario por auth_user_id (globalmente único)
  //    Si existe en el tenant correcto → usar tal cual
  //    Si existe en un tenant incorrecto (corrida anterior del seed) → moverlo
  const { data: existingCU } = await supabase
    .from('comercio_usuarios')
    .select('id, tenant_id')
    .eq('auth_user_id', authUserId!)
    .maybeSingle()

  if (existingCU?.id) {
    if (existingCU.tenant_id === tenantId) {
      console.log(`  ✓ Empleado demo ya existe — ${info.nombre} (${info.username})`)
      return { empleadoId: existingCU.id as string }
    }

    // Está en el tenant equivocado → actualizarlo al tenant correcto
    const { error: updateError } = await supabase
      .from('comercio_usuarios')
      .update({ tenant_id: tenantId, email: demoEmail })
      .eq('id', existingCU.id)

    if (updateError) throw new Error(`Error moviendo empleado al tenant correcto: ${updateError.message}`)
    console.log(`  ✓ Empleado demo reubicado al tenant correcto — ${info.nombre} (${info.username})`)
    return { empleadoId: existingCU.id as string }
  }

  // 3. No existe → crearlo
  const { data: cu, error: cuError } = await supabase
    .from('comercio_usuarios')
    .insert({
      tenant_id:    tenantId,
      auth_user_id: authUserId,
      nombre:       info.nombre,
      email:        demoEmail,
      rol:          'EMPLOYEE',
      activo:       true,
      metadata: {
        auditoria:      true,
        seed:           'audit_demo',
        login_username: info.username,
      },
    })
    .select('id')
    .single()

  if (cuError || !cu?.id) throw new Error(`Error creando empleado demo: ${cuError?.message}`)
  console.log(`  ✓ Empleado demo creado — ${info.nombre} (${info.username})`)
  return { empleadoId: cu.id as string }
}

// ─── Paso 3: Ventas históricas (20 en 3 turnos) ──────────────────────────────

async function seedVentasHistoricas(
  tenantId: string,
  empleadoId: string,
  productoIds: string[]
): Promise<void> {
  if (productoIds.length === 0) {
    console.log('  ⚠️  Sin productos — saltando ventas históricas')
    return
  }

  const { count: turnosExistentes } = await supabase
    .from('turnos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('comercio_usuario_id', empleadoId)
    .eq('estado', 'CERRADO')

  if ((turnosExistentes ?? 0) > 0) {
    console.log(`  ✓ Turnos históricos ya existen (${turnosExistentes}) — saltando`)
    return
  }

  // 3 turnos: hace 3, 2 y 1 día → 6 + 7 + 7 = 20 ventas
  const distribuciones = [
    { diasAtrasN: 3, cantVentas: 6,  cajaInicial: 5000 },
    { diasAtrasN: 2, cantVentas: 7,  cajaInicial: 8000 },
    { diasAtrasN: 1, cantVentas: 7,  cajaInicial: 10000 },
  ]

  let ventasTotales = 0

  for (const dist of distribuciones) {
    const fechaBase = diasAtras(dist.diasAtrasN)
    const fechaOperativa = fechaBase.toISOString().slice(0, 10)
    const abiertoAt = horaLaboral(fechaBase, 0)    // 09:00
    const cerradoAt = horaLaboral(fechaBase, 660)  // 20:00

    const { data: turno, error: turnoError } = await supabase
      .from('turnos')
      .insert({
        tenant_id:           tenantId,
        comercio_usuario_id: empleadoId,
        fecha_operativa:     fechaOperativa,
        abierto_at:          abiertoAt.toISOString(),
        cerrado_at:          cerradoAt.toISOString(),
        caja_inicial:        dist.cajaInicial,
        estado:              'CERRADO',
        observaciones:       'Turno de demo — auditoría SIC',
        metadata:            { auditoria: true, seed: 'audit_demo' },
      })
      .select('id')
      .single()

    if (turnoError || !turno?.id) throw new Error(`Error creando turno: ${turnoError?.message}`)
    const turnoId = turno.id as string

    let totalEfectivo = 0
    let totalTarjeta = 0
    let totalTransferencia = 0
    let totalGeneral = 0

    for (let i = 0; i < dist.cantVentas; i++) {
      const metodoPago = randomPago()
      // Distribuir las ventas a lo largo del turno (evitar primeros 5 y últimos 5 min)
      const minutosOffset = randomInt(15, 635)
      const createdAt = horaLaboral(fechaBase, minutosOffset)

      // 1-3 productos por venta
      const cantProductos = randomInt(1, 3)
      const seleccionados = [...productoIds]
        .sort(() => Math.random() - 0.5)
        .slice(0, cantProductos)

      const { data: prods } = await supabase
        .from('productos')
        .select('id, precio_venta, permite_fraccion')
        .in('id', seleccionados)

      if (!prods || prods.length === 0) continue

      type Item = { productoId: string; cantidad: number; precioUnitario: number; subtotal: number }
      const items: Item[] = prods.map(prod => {
        const cantidad = prod.permite_fraccion
          ? randomFloat(0.2, 2.5, 3)
          : randomInt(1, 3)
        const precioUnitario = prod.precio_venta as number
        return {
          productoId:      prod.id as string,
          cantidad,
          precioUnitario,
          subtotal: parseFloat((cantidad * precioUnitario).toFixed(2)),
        }
      })

      const total = parseFloat(items.reduce((s, it) => s + it.subtotal, 0).toFixed(2))

      const { data: venta, error: ventaError } = await supabase
        .from('ventas')
        .insert({
          tenant_id:           tenantId,
          comercio_usuario_id: empleadoId,
          turno_id:            turnoId,
          total,
          subtotal:            total,
          metodo_pago:         metodoPago,
          estado:              'COMPLETADA',
          metadata:            { auditoria: true, seed: 'audit_demo' },
          created_at:          createdAt.toISOString(),
        })
        .select('id')
        .single()

      if (ventaError || !venta?.id) {
        console.log(`    ⚠️  Error creando venta ${i + 1}: ${ventaError?.message}`)
        continue
      }

      await supabase.from('venta_detalles').insert(
        items.map(it => ({
          tenant_id:       tenantId,
          venta_id:        venta.id,
          producto_id:     it.productoId,
          cantidad:        it.cantidad,
          precio_unitario: it.precioUnitario,
          subtotal:        it.subtotal,
        }))
      )

      if (metodoPago === 'EFECTIVO')      totalEfectivo      += total
      if (metodoPago === 'TARJETA')       totalTarjeta       += total
      if (metodoPago === 'TRANSFERENCIA') totalTransferencia += total
      totalGeneral += total
      ventasTotales++
    }

    // Actualizar totales del turno (incluye pequeña diferencia de arqueo realista)
    const efectivoEsperado  = dist.cajaInicial + totalEfectivo
    const efectivoDeclarado = efectivoEsperado + randomInt(-500, 500)
    await supabase
      .from('turnos')
      .update({
        total_efectivo:      parseFloat(totalEfectivo.toFixed(2)),
        total_tarjeta:       parseFloat(totalTarjeta.toFixed(2)),
        total_transferencia: parseFloat(totalTransferencia.toFixed(2)),
        total_mercado_pago:  0,
        total_general:       parseFloat(totalGeneral.toFixed(2)),
        efectivo_esperado:   parseFloat(efectivoEsperado.toFixed(2)),
        efectivo_declarado:  parseFloat(efectivoDeclarado.toFixed(2)),
        diferencia_caja:     parseFloat((efectivoDeclarado - efectivoEsperado).toFixed(2)),
      })
      .eq('id', turnoId)

    console.log(
      `  ✓ Turno ${fechaOperativa}: ${dist.cantVentas} ventas | ` +
      `$${totalGeneral.toFixed(0)} total ` +
      `(ef: $${totalEfectivo.toFixed(0)} / ` +
      `tarj: $${totalTarjeta.toFixed(0)} / ` +
      `transf: $${totalTransferencia.toFixed(0)})`
    )
  }

  console.log(`  ✓ ${ventasTotales} ventas históricas en 3 turnos`)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed de simulación realista — Tenants de Auditoría\n')

  // Filtramos por el patrón de email que usan los tenants de auditoría (audit.*@sic.local)
  // para evitar incluir el tenant viejo con test@trikode.com.ar que tiene metadata.auditoria=true
  const { data: tenants, error } = await supabase
    .from('comercios')
    .select('tenant_id, nombre, rubro_id, email, metadata')
    .like('email', 'audit.%@sic.local')

  if (error) throw new Error(`Error leyendo comercios: ${error.message}`)
  if (!tenants || tenants.length === 0) {
    console.log('⚠️  No se encontraron tenants de auditoría.')
    console.log('   Primero corrés: npm run seed:auditoria')
    process.exit(1)
  }

  console.log(`Encontrados ${tenants.length} tenants de auditoría:\n`)

  const rubroIds = [...new Set(tenants.map(t => t.rubro_id).filter(Boolean))]
  const { data: rubros } = await supabase
    .from('rubros')
    .select('id, nombre')
    .in('id', rubroIds)

  const rubroMap = new Map((rubros ?? []).map(r => [r.id as string, r.nombre as string]))

  for (const tenant of tenants) {
    const rubroNombre = rubroMap.get(tenant.rubro_id) ?? 'Desconocido'
    console.log(`📦 ${tenant.nombre} (${rubroNombre})`)

    try {
      const productoIds  = await seedProductos(tenant.tenant_id, rubroNombre)
      const { empleadoId } = await seedEmpleadoDemo(tenant.tenant_id, rubroNombre)
      await seedVentasHistoricas(tenant.tenant_id, empleadoId, productoIds)
    } catch (err) {
      console.error(`  ❌ Error en tenant ${tenant.nombre}:`, err)
    }

    console.log()
  }

  console.log('✅ Seed completado.\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Credenciales de demo:')
  console.log(`  Owner (todos los rubros): ${ADMIN_EMAIL}`)
  console.log('  Empleado:  <username>  (ej: kioscos_demo, carniceria_demo)')
  console.log('  PIN/pass:  el valor de SEED_AUDIT_PASS en tu .env.local')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
