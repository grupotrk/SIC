-- ========================================
-- TRIKODE - TABLA DE LEADS
-- ========================================

-- Tabla de Leads para nuevos clientes
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_comercio VARCHAR(100) NOT NULL,
    rubro VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    mensaje TEXT,
    referral_code VARCHAR(20),
    accepted_terms BOOLEAN NOT NULL DEFAULT false,
    tos_version VARCHAR(20),
    tos_accepted_at TIMESTAMP WITH TIME ZONE,
    tos_ip INET,
    plan VARCHAR(50) DEFAULT 'Completo',
    plan_precio DECIMAL(12,2) DEFAULT 40000,
    estado VARCHAR(20) DEFAULT 'PENDIENTE',
    mercado_pago_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compatibilidad para entornos existentes: agregar columnas nuevas si faltan.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mensaje TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'Completo';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS plan_precio DECIMAL(12,2) DEFAULT 40000;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tos_version VARCHAR(20);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tos_ip INET;

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_referral_code ON leads(referral_code);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at 
    BEFORE UPDATE ON leads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies para leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Solo usuarios autenticados pueden ver leads
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver leads" ON leads;
CREATE POLICY "Usuarios autenticados pueden ver leads"
    ON leads FOR SELECT
    USING (auth.role() = 'authenticated');

-- Solo usuarios autenticados pueden insertar leads
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear leads" ON leads;
CREATE POLICY "Usuarios autenticados pueden crear leads"
    ON leads FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Opcional (recomendado para alta 100% automática desde landing):
-- permite registrar leads sin login (rol anon) pero NO da acceso a leerlos.
DROP POLICY IF EXISTS "Registro público de leads (anon)" ON leads;
CREATE POLICY "Registro público de leads (anon)"
    ON leads FOR INSERT
    WITH CHECK (auth.role() = 'anon');

-- Solo usuarios autenticados pueden actualizar leads
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar leads" ON leads;
CREATE POLICY "Usuarios autenticados pueden actualizar leads"
    ON leads FOR UPDATE
    USING (auth.role() = 'authenticated');
