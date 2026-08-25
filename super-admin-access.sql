-- ========================================
-- TRIKODE - SUPERADMIN DE AUDITORIA TECNICA
-- ========================================

CREATE TABLE IF NOT EXISTS super_admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    sandbox_tenant_id UUID NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_users_auth_user_id ON super_admin_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_users_sandbox_tenant_id ON super_admin_users(sandbox_tenant_id);

DROP TRIGGER IF EXISTS update_super_admin_users_updated_at ON super_admin_users;
CREATE TRIGGER update_super_admin_users_updated_at
    BEFORE UPDATE ON super_admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE super_admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_users_select_self ON super_admin_users;
CREATE POLICY super_admin_users_select_self ON super_admin_users
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE OR REPLACE FUNCTION current_user_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM super_admin_users sau
        WHERE sau.auth_user_id = auth.uid()
          AND sau.activo = true
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE super_admin_users IS 'Usuarios internos de auditoria tecnica con acceso transversal al SIC.';
COMMENT ON FUNCTION current_user_is_super_admin() IS 'Indica si el usuario autenticado es un SuperAdmin de auditoria tecnica.';