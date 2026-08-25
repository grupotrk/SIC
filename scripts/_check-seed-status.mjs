import { createClient } from '@supabase/supabase-js'

const s = createClient(
  'https://twmzqvapkszjisczrlnc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'
)

const { data: rubros } = await s.from('rubros').select('id,nombre').order('nombre')
const { data: comercios } = await s.from('comercios').select('tenant_id,nombre,rubro_id').order('nombre')
const { data: prods } = await s.from('productos_tienda').select('tenant_id,categoria')
const { data: empleados } = await s.from('comercio_usuarios').select('tenant_id,nombre,rol,activo').eq('activo', true)
const { data: planes } = await s.from('planes').select('id,nombre').order('nombre')

// Productos por tenant
const prodsPorTenant = {}
for (const p of (prods || [])) {
  prodsPorTenant[p.tenant_id] = (prodsPorTenant[p.tenant_id] || 0) + 1
}

// Categorías por tenant
const catsPorTenant = {}
for (const p of (prods || [])) {
  if (!catsPorTenant[p.tenant_id]) catsPorTenant[p.tenant_id] = new Set()
  catsPorTenant[p.tenant_id].add(p.categoria)
}

// Empleados por tenant
const empPorTenant = {}
for (const e of (empleados || [])) {
  if (!empPorTenant[e.tenant_id]) empPorTenant[e.tenant_id] = []
  empPorTenant[e.tenant_id].push({ nombre: e.nombre, rol: e.rol })
}

// Mapa rubroId → nombre
const rubroMap = {}
for (const r of (rubros || [])) rubroMap[r.id] = r.nombre

console.log('\n========== RUBROS DISPONIBLES ==========')
for (const r of (rubros || [])) console.log(`  ${r.nombre} (${r.id})`)

console.log('\n========== COMERCIOS (TENANTS) ==========')
for (const c of (comercios || [])) {
  const rubro = rubroMap[c.rubro_id] || c.rubro_id
  const nProd = prodsPorTenant[c.tenant_id] || 0
  const cats = catsPorTenant[c.tenant_id] ? [...catsPorTenant[c.tenant_id]].sort() : []
  const emps = empPorTenant[c.tenant_id] || []
  const owners = emps.filter(e => e.rol === 'OWNER').map(e => e.nombre)
  const employees = emps.filter(e => e.rol === 'EMPLOYEE').map(e => e.nombre)

  console.log(`\n  📦 ${c.nombre}`)
  console.log(`     Rubro:      ${rubro}`)
  console.log(`     Productos:  ${nProd}`)
  if (cats.length) console.log(`     Categorías: ${cats.join(', ')}`)
  if (owners.length) console.log(`     Owners:     ${owners.join(', ')}`)
  if (employees.length) console.log(`     Empleados:  ${employees.join(', ')}`)
  else console.log(`     Empleados:  ⚠️  NINGUNO`)
}

if (planes) {
  console.log('\n========== PLANES ==========')
  for (const p of planes) console.log(`  ${p.nombre} (${p.id})`)
}
