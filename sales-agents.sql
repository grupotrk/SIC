-- ========================================
-- TRIKODE - AGENTES DE VENTAS / REFERIDOS
-- ========================================

-- Tabla de agentes de ventas (quién vendió a quién)
CREATE TABLE IF NOT EXISTS sales_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20),
    email VARCHAR(100),
    ref_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
    commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.3000,
    active_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    inactive_from TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_agents_ref_code ON sales_agents(ref_code);
CREATE INDEX IF NOT EXISTS idx_sales_agents_status ON sales_agents(status);

-- Trigger updated_at (usa la función ya creada en otros scripts: update_updated_at_column)
DROP TRIGGER IF EXISTS update_sales_agents_updated_at ON sales_agents;
CREATE TRIGGER update_sales_agents_updated_at
    BEFORE UPDATE ON sales_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE sales_agents ENABLE ROW LEVEL SECURITY;

-- Por seguridad: NO exponer la lista de agentes públicamente.
-- Esto se administra desde tu panel secreto (authenticated).
DROP POLICY IF EXISTS "Admin puede gestionar sales_agents" ON sales_agents;
CREATE POLICY "Admin puede gestionar sales_agents"
    ON sales_agents FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

