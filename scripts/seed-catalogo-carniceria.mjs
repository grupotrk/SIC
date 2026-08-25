/**
 * Seed catálogo de carnicería para tenants de auditoría.
 * Carga cortes vacunos, cerdo, achuras, embutidos y pollo.
 * Los precios son de referencia (abril 2026) — actualizar según zona.
 *
 * Uso: node scripts/seed-catalogo-carniceria.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Tenants de carnicería (de debug-all-audit-tenants)
const TENANT_CARNICERIA         = '68856a35-f406-4b5a-ae1e-eae256e75b9c'  // audit.carniceria
const TENANT_CARNICERIA_VERD    = '28861dc4-003c-438a-aa57-c8458928de9e'  // audit.carniceriaverduleria

// Catálogo — precio_venta en ARS por kg (referencia abril 2026)
const CATALOGO_CARNICERIA = [
  // ─── VACUNO ────────────────────────────────────────────────────────────────
  { nombre: 'Asado',                  categoria: 'Vacuno',    precio_venta: 12000, precio_costo: 8500 },
  { nombre: 'Tira de asado',          categoria: 'Vacuno',    precio_venta: 13500, precio_costo: 9000 },
  { nombre: 'Costillar',              categoria: 'Vacuno',    precio_venta: 11000, precio_costo: 7500 },
  { nombre: 'Bife de chorizo',        categoria: 'Vacuno',    precio_venta: 18000, precio_costo: 12000 },
  { nombre: 'Bife angosto',           categoria: 'Vacuno',    precio_venta: 16000, precio_costo: 11000 },
  { nombre: 'Bife ancho',             categoria: 'Vacuno',    precio_venta: 17000, precio_costo: 11500 },
  { nombre: 'Lomo',                   categoria: 'Vacuno',    precio_venta: 24000, precio_costo: 16000 },
  { nombre: 'Cuadril',                categoria: 'Vacuno',    precio_venta: 15000, precio_costo: 10000 },
  { nombre: 'Colita de cuadril',      categoria: 'Vacuno',    precio_venta: 14500, precio_costo: 9800 },
  { nombre: 'Nalga',                  categoria: 'Vacuno',    precio_venta: 13000, precio_costo: 8800 },
  { nombre: 'Peceto',                 categoria: 'Vacuno',    precio_venta: 13500, precio_costo: 9000 },
  { nombre: 'Paleta',                 categoria: 'Vacuno',    precio_venta: 11500, precio_costo: 7800 },
  { nombre: 'Matambre',               categoria: 'Vacuno',    precio_venta: 14000, precio_costo: 9500 },
  { nombre: 'Vacío',                  categoria: 'Vacuno',    precio_venta: 13000, precio_costo: 8800 },
  { nombre: 'Entraña',                categoria: 'Vacuno',    precio_venta: 16000, precio_costo: 11000 },
  { nombre: 'Falda',                  categoria: 'Vacuno',    precio_venta: 10000, precio_costo: 6800 },
  { nombre: 'Osobuco',                categoria: 'Vacuno',    precio_venta: 9500,  precio_costo: 6500 },
  { nombre: 'Marucha',                categoria: 'Vacuno',    precio_venta: 10500, precio_costo: 7200 },
  { nombre: 'Rabo',                   categoria: 'Vacuno',    precio_venta: 9000,  precio_costo: 6000 },
  { nombre: 'Carnaza',                categoria: 'Vacuno',    precio_venta: 10000, precio_costo: 6800 },
  { nombre: 'Carne picada común',     categoria: 'Vacuno',    precio_venta: 10500, precio_costo: 7000 },
  { nombre: 'Carne picada especial',  categoria: 'Vacuno',    precio_venta: 12000, precio_costo: 8000 },

  // ─── CERDO ─────────────────────────────────────────────────────────────────
  { nombre: 'Bondiola de cerdo',      categoria: 'Cerdo',     precio_venta: 11000, precio_costo: 7500 },
  { nombre: 'Costillas de cerdo',     categoria: 'Cerdo',     precio_venta: 10000, precio_costo: 6800 },
  { nombre: 'Paleta de cerdo',        categoria: 'Cerdo',     precio_venta: 9500,  precio_costo: 6500 },
  { nombre: 'Lomo de cerdo',          categoria: 'Cerdo',     precio_venta: 12000, precio_costo: 8000 },
  { nombre: 'Matambre de cerdo',      categoria: 'Cerdo',     precio_venta: 11000, precio_costo: 7500 },
  { nombre: 'Panceta',                categoria: 'Cerdo',     precio_venta: 10000, precio_costo: 7000 },

  // ─── ACHURAS ───────────────────────────────────────────────────────────────
  { nombre: 'Chinchulines',           categoria: 'Achuras',   precio_venta: 8000,  precio_costo: 5500 },
  { nombre: 'Tripa gorda',            categoria: 'Achuras',   precio_venta: 7500,  precio_costo: 5000 },
  { nombre: 'Molleja',                categoria: 'Achuras',   precio_venta: 12000, precio_costo: 8000 },
  { nombre: 'Riñón',                  categoria: 'Achuras',   precio_venta: 7000,  precio_costo: 4800 },
  { nombre: 'Corazón',                categoria: 'Achuras',   precio_venta: 8000,  precio_costo: 5500 },
  { nombre: 'Hígado',                 categoria: 'Achuras',   precio_venta: 7500,  precio_costo: 5000 },
  { nombre: 'Lengua',                 categoria: 'Achuras',   precio_venta: 11000, precio_costo: 7500 },
  { nombre: 'Seso',                   categoria: 'Achuras',   precio_venta: 9000,  precio_costo: 6000 },

  // ─── EMBUTIDOS ─────────────────────────────────────────────────────────────
  { nombre: 'Chorizo',                categoria: 'Embutidos', precio_venta: 9000,  precio_costo: 6200 },
  { nombre: 'Morcilla',               categoria: 'Embutidos', precio_venta: 8000,  precio_costo: 5500 },
  { nombre: 'Salchicha parrillera',   categoria: 'Embutidos', precio_venta: 9500,  precio_costo: 6500 },
  { nombre: 'Longaniza',              categoria: 'Embutidos', precio_venta: 10000, precio_costo: 7000 },

  // ─── POLLO ─────────────────────────────────────────────────────────────────
  { nombre: 'Pollo entero',           categoria: 'Pollo',     precio_venta: 6500,  precio_costo: 4500 },
  { nombre: 'Pechuga de pollo',       categoria: 'Pollo',     precio_venta: 8000,  precio_costo: 5500 },
  { nombre: 'Muslo de pollo',         categoria: 'Pollo',     precio_venta: 7000,  precio_costo: 4800 },
  { nombre: 'Contramuslo de pollo',   categoria: 'Pollo',     precio_venta: 7500,  precio_costo: 5000 },
  { nombre: 'Alitas de pollo',        categoria: 'Pollo',     precio_venta: 6500,  precio_costo: 4500 },
  { nombre: 'Cuarto trasero pollo',   categoria: 'Pollo',     precio_venta: 7000,  precio_costo: 4800 },

  // ─── CORDERO (opcional) ────────────────────────────────────────────────────
  { nombre: 'Costillar de cordero',   categoria: 'Cordero',   precio_venta: 14000, precio_costo: 9500 },
  { nombre: 'Pierna de cordero',      categoria: 'Cordero',   precio_venta: 13000, precio_costo: 8800 },
]

// Verduras para tenant carnicería+verdulería
const CATALOGO_VERDULERIA = [
  { nombre: 'Papa',          categoria: 'Verduras',  precio_venta: 1200, precio_costo: 800  },
  { nombre: 'Cebolla',       categoria: 'Verduras',  precio_venta: 1000, precio_costo: 650  },
  { nombre: 'Zanahoria',     categoria: 'Verduras',  precio_venta: 1100, precio_costo: 750  },
  { nombre: 'Tomate',        categoria: 'Verduras',  precio_venta: 2000, precio_costo: 1400 },
  { nombre: 'Morrón rojo',   categoria: 'Verduras',  precio_venta: 2500, precio_costo: 1700 },
  { nombre: 'Zapallo',       categoria: 'Verduras',  precio_venta: 1000, precio_costo: 650  },
  { nombre: 'Batata',        categoria: 'Verduras',  precio_venta: 1300, precio_costo: 900  },
  { nombre: 'Ajo',           categoria: 'Verduras',  precio_venta: 4000, precio_costo: 2800 },
  { nombre: 'Lechuga',       categoria: 'Verduras',  precio_venta: 1500, precio_costo: 1000 },
  { nombre: 'Limón',         categoria: 'Frutas',    precio_venta: 1800, precio_costo: 1200 },
  { nombre: 'Naranja',       categoria: 'Frutas',    precio_venta: 1500, precio_costo: 1000 },
]

async function seedTenant(tenantId, items, label) {
  console.log(`\n── ${label} (${tenantId}) ──`)

  // Verificar si ya tiene productos
  const { data: existing, error: checkErr } = await supabase
    .from('productos_tienda')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)

  if (checkErr) {
    console.log(`  ❌ Error verificando: ${checkErr.message}`)
    return
  }

  if (existing?.length > 0) {
    console.log(`  ⚠️  Ya tiene productos cargados. Omitido para no duplicar.`)
    console.log(`     Si querés re-seedear, eliminá los productos primero desde el panel.`)
    return
  }

  const rows = items.map(item => ({
    tenant_id:       tenantId,
    nombre:          item.nombre,
    marca:           '',
    categoria:       item.categoria,
    unidad_medida:   'kg',
    precio_venta:    item.precio_venta,
    precio_costo:    item.precio_costo,
    stock_actual:    0,
    stock_minimo:    0,
    permite_fraccion: true,
    activo:          true,
  }))

  const { error } = await supabase
    .from('productos_tienda')
    .insert(rows)

  if (error) {
    console.log(`  ❌ Error insertando: ${error.message}`)
  } else {
    console.log(`  ✅ ${rows.length} productos insertados`)
  }
}

async function main() {
  await seedTenant(TENANT_CARNICERIA,      CATALOGO_CARNICERIA,                         'Auditoría Carnicería')
  await seedTenant(TENANT_CARNICERIA_VERD, [...CATALOGO_CARNICERIA, ...CATALOGO_VERDULERIA], 'Auditoría Carnicería/Verdulería')

  console.log('\nListo. Precios de referencia — actualizar según zona desde el panel de Owner.\n')
}

main()
