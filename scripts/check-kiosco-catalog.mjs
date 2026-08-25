import { createClient } from '@supabase/supabase-js'
const s = createClient(
  'https://twmzqvapkszjisczrlnc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'
)

// comercios.id != comercios.tenant_id — usar tenant_id para productos_tienda
const { data: comercios } = await s
  .from('comercios')
  .select('id,tenant_id,nombre')
  .ilike('nombre','%kiosc%')

console.log('Comercios encontrados:', comercios?.map(t => `${t.nombre} (id=${t.id} | tenant_id=${t.tenant_id})`))

for (const c of comercios ?? []) {
  const { data: prods } = await s
    .from('productos_tienda')
    .select('nombre,categoria,precio_venta')
    .eq('tenant_id', c.tenant_id)   // <-- usar tenant_id del comercio, no el id
    .eq('activo', true)
    .order('categoria')
    .order('nombre')

  console.log(`\n====== ${c.nombre} | Total: ${prods?.length} ======`)
  const cats = [...new Set(prods?.map(p => p.categoria) ?? [])]
  for (const cat of cats) {
    const sub = prods?.filter(p => p.categoria === cat) ?? []
    console.log(`\n  [${cat}] (${sub.length})`)
    sub.forEach(p => console.log(`    - ${p.nombre}  $${p.precio_venta}`))
  }
}
