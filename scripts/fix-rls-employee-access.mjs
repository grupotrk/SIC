/**
 * Fix RLS: cambia auth.uid() = tenant_id  →  tenant_id = current_tenant_id()
 * Necesario para que empleados puedan leer productos, insertar ventas y abrir turnos.
 * current_tenant_id() ya existe en la BD y lee tenant_id del JWT user_metadata.
 */
import { createClient } from '@supabase/supabase-js'

const URL = 'https://twmzqvapkszjisczrlnc.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdGdkZ3RudHZhbHdtZmV3cnhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1OTM5OCwiZXhwIjoyMDg4NDM1Mzk4fQ.Vo9ZrWO8J9fFNxuezYbwZnGlC2uqMeO6FB2sl-ztqwk'

const s = createClient(URL, KEY)

// Ejecuta SQL usando el endpoint de Supabase SQL (disponible con service_role)
async function sql(query) {
  const res = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({ query }),
  })
  // exec_sql puede no existir — alternativa: usar postgres directamente via pg
  return { status: res.status, body: await res.text() }
}

// Plan B: usar el cliente para insertar en una tabla ficticia y ver si falla
// La única forma de ejecutar DDL sin exec_sql es via psql o Supabase dashboard.
// Generamos el script listo para pegar en el SQL Editor.

const SCRIPT = `
-- ============================================================
--  FIX RLS EMPLEADOS: ejecutar en Supabase SQL Editor
--  Cambia auth.uid() = tenant_id  por  tenant_id = current_tenant_id()
--  para que empleados puedan acceder a sus datos del tenant.
-- ============================================================

-- 1. PRODUCTOS_TIENDA
DROP POLICY IF EXISTS "Usuarios solo pueden ver sus productos" ON productos_tienda;
CREATE POLICY "tenant_productos_tienda_all" ON productos_tienda
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- 2. TURNOS
DROP POLICY IF EXISTS "turnos_select_own" ON turnos;
DROP POLICY IF EXISTS "turnos_insert_own" ON turnos;
DROP POLICY IF EXISTS "turnos_update_own" ON turnos;
DROP POLICY IF EXISTS "turnos_delete_own" ON turnos;
CREATE POLICY "tenant_turnos_all" ON turnos
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- 3. VENTAS
DROP POLICY IF EXISTS "ventas_select_own" ON ventas;
DROP POLICY IF EXISTS "ventas_insert_own" ON ventas;
DROP POLICY IF EXISTS "ventas_update_own" ON ventas;
DROP POLICY IF EXISTS "ventas_delete_own" ON ventas;
CREATE POLICY "tenant_ventas_all" ON ventas
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- 4. VENTA_DETALLES
DROP POLICY IF EXISTS "venta_detalles_select_own" ON venta_detalles;
DROP POLICY IF EXISTS "venta_detalles_insert_own" ON venta_detalles;
DROP POLICY IF EXISTS "venta_detalles_update_own" ON venta_detalles;
DROP POLICY IF EXISTS "venta_detalles_delete_own" ON venta_detalles;
CREATE POLICY "tenant_venta_detalles_all" ON venta_detalles
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- 5. CIERRES_DIARIOS (si existe la tabla)
DROP POLICY IF EXISTS "cierres_select_own" ON cierres_diarios;
DROP POLICY IF EXISTS "cierres_insert_own" ON cierres_diarios;
DROP POLICY IF EXISTS "cierres_update_own" ON cierres_diarios;
CREATE POLICY "tenant_cierres_all" ON cierres_diarios
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- 6. ACTUALIZACIONES_PRECIOS
DROP POLICY IF EXISTS "Usuarios solo pueden ver sus actualizaciones" ON actualizaciones_precios;
CREATE POLICY "tenant_actualizaciones_precios_all" ON actualizaciones_precios
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Verificación final
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('productos_tienda','turnos','ventas','venta_detalles','cierres_diarios')
ORDER BY tablename, policyname;
`

console.log('\n========================================================')
console.log(' COPIÁ ESTE SQL Y PEGALO EN EL SQL EDITOR DE SUPABASE ')
console.log(' https://supabase.com/dashboard/project/twmzqvapkszjisczrlnc/sql/new')
console.log('========================================================\n')
console.log(SCRIPT)
