-- ========================================================
-- FIX CRÍTICO: RLS en comercio_usuarios + current_tenant_id
-- PROBLEMA: current_tenant_id() no leía tenant_id de user_metadata,
--           haciendo que todas las queries frontend devolvieran null.
-- EJECUTAR: Supabase SQL Editor (con permisos de superusuario)
-- ========================================================

-- 1. Corregir current_tenant_id() para leer tenant_id desde user_metadata del JWT.
--    El fallback a auth.uid() sólo aplica si no hay tenant_id en ningún lugar.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
DECLARE
    jwt_tenant TEXT;
    meta_tenant TEXT;
BEGIN
    -- Primero: claim raíz del JWT (para compatibilidad con auth hooks futuros)
    jwt_tenant := auth.jwt() ->> 'tenant_id';
    IF jwt_tenant IS NOT NULL AND jwt_tenant <> '' THEN
        RETURN jwt_tenant::UUID;
    END IF;

    -- Segundo: user_metadata.tenant_id (donde Supabase almacena el metadata del usuario)
    meta_tenant := auth.jwt() -> 'user_metadata' ->> 'tenant_id';
    IF meta_tenant IS NOT NULL AND meta_tenant <> '' THEN
        RETURN meta_tenant::UUID;
    END IF;

    -- Fallback: uid del usuario (para retrocompatibilidad; no debería ocurrir en producción)
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Marcar current_user_is_owner() como SECURITY DEFINER para evitar
--    recursión infinita cuando se llama desde dentro de una policy RLS.
CREATE OR REPLACE FUNCTION current_user_is_owner()
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM comercio_usuarios cu
        WHERE cu.auth_user_id = auth.uid()
          AND cu.tenant_id = current_tenant_id()
          AND cu.rol = 'OWNER'
          AND cu.activo = true
    ) INTO v_result;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Recrear la policy de SELECT en comercio_usuarios.
--    Permite:
--    a) Cada usuario siempre puede leer SU PROPIO registro (por auth_user_id).
--    b) Un OWNER puede leer todos los registros de su tenant.
DROP POLICY IF EXISTS comercio_usuarios_select_policy ON comercio_usuarios;
CREATE POLICY comercio_usuarios_select_policy ON comercio_usuarios
    FOR SELECT USING (
        auth_user_id = auth.uid()
        OR (tenant_id = current_tenant_id() AND current_user_is_owner())
    );

-- Verificación: listar las policies activas en comercio_usuarios
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'comercio_usuarios';
