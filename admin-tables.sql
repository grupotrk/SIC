-- ========================================
-- TRIKODE - SISTEMA ADMINISTRATIVO
-- ========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla de usuarios administradores
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL DEFAULT 'admin',
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de logs de recuperación de contraseña
CREATE TABLE IF NOT EXISTS password_reset_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(100) NOT NULL,
    token VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de logs de notificaciones
CREATE TABLE IF NOT EXISTS notificacion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id),
    tipo VARCHAR(20) NOT NULL, -- 'WHATSAPP', 'EMAIL'
    motivo VARCHAR(50) NOT NULL, -- 'VENCIMIENTO', 'RENOVACION', 'BIENVENIDA'
    mensaje TEXT NOT NULL,
    enviado BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enviado_at TIMESTAMP WITH TIME ZONE
);

-- Trigger para updated_at en admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON admin_users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insertar usuario admin por defecto
-- Reemplazar el hash por un hash bcrypt generado con la contraseña real (ver ADMIN_PASSWORD en .env.local)
INSERT INTO admin_users (username, password_hash, email) 
VALUES ('admin', '$2b$12$REEMPLAZAR_CON_HASH_REAL', 'trikodeingenieria@gmail.com')
ON CONFLICT (username) DO NOTHING;

-- Vista de clientes con estado y días calculados
DROP VIEW IF EXISTS clientes_con_estado;
CREATE VIEW clientes_con_estado WITH (security_invoker = true) AS
SELECT 
    l.id,
    l.nombre_comercio,
    l.rubro,
    l.whatsapp,
    l.email,
    l.mensaje,
    l.referral_code,
    l.accepted_terms,
    l.tos_version,
    l.tos_accepted_at,
    l.tos_ip,
    l.plan,
    l.plan_precio,
    l.estado AS estado_lead,
    l.mercado_pago_link,
    l.created_at,
    l.updated_at,
    COALESCE(c.suscripcion_vence_at::date, DATE(l.created_at) + 30) AS fecha_vencimiento,
    CASE 
        WHEN COALESCE(c.suscripcion_vence_at::date, DATE(l.created_at) + 30) < CURRENT_DATE THEN 'Vencido'
        WHEN COALESCE(c.suscripcion_vence_at::date, DATE(l.created_at) + 30) = CURRENT_DATE THEN 'Por vencer'
        ELSE 'Activo'
    END as estado,
    GREATEST(0, CURRENT_DATE - COALESCE(c.suscripcion_vence_at::date, DATE(l.created_at) + 30)) as dias_transcurridos,
    c.tenant_id,
    c.estado_suscripcion,
    c.gracia_hasta,
    c.solo_descarga_hasta,
    c.depurado_at
FROM leads l
LEFT JOIN comercios c ON LOWER(COALESCE(c.email, '')) = LOWER(COALESCE(l.email, ''))
WHERE l.estado = 'PAGADO' OR l.estado = 'PENDIENTE';

-- RLS Policies
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacion_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin puede ver usuarios admin" ON admin_users;
DROP POLICY IF EXISTS "Admin puede ver logs" ON password_reset_logs;
DROP POLICY IF EXISTS "Admin puede ver notificaciones" ON notificacion_logs;

-- Solo admin puede ver/manejar usuarios admin
CREATE POLICY "Admin puede ver usuarios admin"
    ON admin_users FOR ALL
    USING (auth.role() = 'authenticated');

-- Solo admin puede ver logs
CREATE POLICY "Admin puede ver logs"
    ON password_reset_logs FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admin puede ver notificaciones"
    ON notificacion_logs FOR ALL
    USING (auth.role() = 'authenticated');
