-- ========================================
-- FIX: Username globalmente único
-- (Aplica para OWNER y EMPLOYEE)
-- ========================================

-- Redefine la función para validar username GLOBALMENTE
CREATE OR REPLACE FUNCTION enforce_unique_login_username_by_role()
RETURNS TRIGGER AS $$
DECLARE
    normalized_login_username TEXT;
    duplicate_exists BOOLEAN;
BEGIN
    normalized_login_username := lower(btrim(coalesce(NEW.metadata->>'login_username', '')));

    IF NEW.activo = true AND normalized_login_username <> '' THEN
        -- Buscar duplicados GLOBALMENTE (sin validar rol ni tenant)
        SELECT EXISTS (
            SELECT 1
            FROM comercio_usuarios cu
            WHERE cu.id <> NEW.id
              AND cu.activo = true
              AND lower(btrim(coalesce(cu.metadata->>'login_username', ''))) = normalized_login_username
        ) INTO duplicate_exists;

        IF duplicate_exists THEN
            RAISE EXCEPTION 'duplicate_login_username_global';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger (sin cambios, pero la función ya es global)
DROP TRIGGER IF EXISTS trg_unique_login_username_by_role ON comercio_usuarios;
CREATE TRIGGER trg_unique_login_username_by_role
    BEFORE INSERT OR UPDATE ON comercio_usuarios
    FOR EACH ROW
    EXECUTE FUNCTION enforce_unique_login_username_by_role();

-- Actualizar el índice para mejor performance en búsquedas globales
DROP INDEX IF EXISTS idx_comercio_usuarios_role_login_username;
CREATE INDEX IF NOT EXISTS idx_comercio_usuarios_global_login_username
    ON comercio_usuarios (lower(btrim(metadata->>'login_username')))
    WHERE activo = true AND btrim(coalesce(metadata->>'login_username', '')) <> '';
