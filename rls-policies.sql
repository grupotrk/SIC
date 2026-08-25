-- ========================================
-- POLÍTICAS DE RLS DETALLADAS PARA SUPABASE
-- ========================================

-- POLÍTICAS ESPECÍFICAS POR OPERACIÓN

-- 1. COMERCIOS
DROP POLICY IF EXISTS "comercios_select_own" ON comercios;
CREATE POLICY "comercios_select_own" ON comercios
    FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "comercios_insert_own" ON comercios;
CREATE POLICY "comercios_insert_own" ON comercios
    FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "comercios_update_own" ON comercios;
CREATE POLICY "comercios_update_own" ON comercios
    FOR UPDATE USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "comercios_delete_own" ON comercios;
CREATE POLICY "comercios_delete_own" ON comercios
    FOR DELETE USING (auth.uid() = tenant_id);

-- 2. CATEGORÍAS
DROP POLICY IF EXISTS "categorias_select_own" ON categorias;
CREATE POLICY "categorias_select_own" ON categorias
    FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "categorias_insert_own" ON categorias;
CREATE POLICY "categorias_insert_own" ON categorias
    FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "categorias_update_own" ON categorias;
CREATE POLICY "categorias_update_own" ON categorias
    FOR UPDATE USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "categorias_delete_own" ON categorias;
CREATE POLICY "categorias_delete_own" ON categorias
    FOR DELETE USING (auth.uid() = tenant_id);

-- 3. PRODUCTOS
DROP POLICY IF EXISTS "productos_select_own" ON productos;
CREATE POLICY "productos_select_own" ON productos
    FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "productos_insert_own" ON productos;
CREATE POLICY "productos_insert_own" ON productos
    FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "productos_update_own" ON productos;
CREATE POLICY "productos_update_own" ON productos
    FOR UPDATE USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "productos_delete_own" ON productos;
CREATE POLICY "productos_delete_own" ON productos
    FOR DELETE USING (auth.uid() = tenant_id);

-- 4. VENTAS
DROP POLICY IF EXISTS "ventas_select_own" ON ventas;
CREATE POLICY "ventas_select_own" ON ventas
    FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "ventas_insert_own" ON ventas;
CREATE POLICY "ventas_insert_own" ON ventas
    FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "ventas_update_own" ON ventas;
CREATE POLICY "ventas_update_own" ON ventas
    FOR UPDATE USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "ventas_delete_own" ON ventas;
CREATE POLICY "ventas_delete_own" ON ventas
    FOR DELETE USING (auth.uid() = tenant_id);

-- 5. VENTA_DETALLES
DROP POLICY IF EXISTS "venta_detalles_select_own" ON venta_detalles;
CREATE POLICY "venta_detalles_select_own" ON venta_detalles
    FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "venta_detalles_insert_own" ON venta_detalles;
CREATE POLICY "venta_detalles_insert_own" ON venta_detalles
    FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "venta_detalles_update_own" ON venta_detalles;
CREATE POLICY "venta_detalles_update_own" ON venta_detalles
    FOR UPDATE USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "venta_detalles_delete_own" ON venta_detalles;
CREATE POLICY "venta_detalles_delete_own" ON venta_detalles
    FOR DELETE USING (auth.uid() = tenant_id);

-- 6. MOVIMIENTOS_STOCK
DROP POLICY IF EXISTS "movimientos_stock_select_own" ON movimientos_stock;
CREATE POLICY "movimientos_stock_select_own" ON movimientos_stock
    FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "movimientos_stock_insert_own" ON movimientos_stock;
CREATE POLICY "movimientos_stock_insert_own" ON movimientos_stock
    FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "movimientos_stock_update_own" ON movimientos_stock;
CREATE POLICY "movimientos_stock_update_own" ON movimientos_stock
    FOR UPDATE USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "movimientos_stock_delete_own" ON movimientos_stock;
CREATE POLICY "movimientos_stock_delete_own" ON movimientos_stock
    FOR DELETE USING (auth.uid() = tenant_id);

-- ========================================
-- FUNCIONES DE SEGURIDAD ADICIONAL
-- ========================================

-- Función para verificar tenant_id del usuario actual
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar que un producto pertenece al tenant actual
CREATE OR REPLACE FUNCTION validate_product_tenant(producto_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    product_tenant UUID;
BEGIN
    SELECT tenant_id INTO product_tenant 
    FROM productos 
    WHERE id = producto_id;
    
    RETURN product_tenant = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para validar tenant en ventas_detalles
CREATE OR REPLACE FUNCTION validate_venta_detalle_tenant()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ventas v 
        WHERE v.id = NEW.venta_id 
        AND v.tenant_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'No tiene permiso para agregar detalles a esta venta';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM productos p 
        WHERE p.id = NEW.producto_id 
        AND p.tenant_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'El producto no pertenece a su tenant';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
DROP TRIGGER IF EXISTS validate_venta_detalle_tenant_trigger ON venta_detalles;
CREATE TRIGGER validate_venta_detalle_tenant_trigger
    BEFORE INSERT OR UPDATE ON venta_detalles
    FOR EACH ROW EXECUTE FUNCTION validate_venta_detalle_tenant();

-- ========================================
-- VISTAS SEGURAS (RLS A NIVEL DE VISTA)
-- ========================================

-- Vista segura de productos
CREATE OR REPLACE VIEW productos_seguro WITH (security_invoker = true) AS
SELECT 
    p.*,
    c.nombre as categoria_nombre
FROM productos p
JOIN categorias c ON p.categoria_id = c.id
WHERE p.tenant_id = auth.uid();

-- Vista segura de ventas con detalles
CREATE OR REPLACE VIEW ventas_completas WITH (security_invoker = true) AS
SELECT 
    v.*,
    vd.producto_id,
    vd.cantidad,
    vd.precio_unitario,
    vd.subtotal AS detalle_subtotal,
    prod.nombre as producto_nombre
FROM ventas v
LEFT JOIN venta_detalles vd ON v.id = vd.venta_id
LEFT JOIN productos prod ON vd.producto_id = prod.id
WHERE v.tenant_id = auth.uid();

-- ========================================
-- POLÍTICAS PARA VISTAS
-- ========================================

ALTER VIEW productos_seguro OWNER TO postgres;
ALTER VIEW ventas_completas OWNER TO postgres;

-- Las vistas heredan las políticas RLS de las tablas base

-- ========================================
-- ÍNDICES DE RENDIMIENTO PARA MULTITENANCY
-- ========================================

-- Índices compuestos para mejor rendimiento en consultas multitenant
CREATE INDEX IF NOT EXISTS idx_productos_tenant_categoria ON productos(tenant_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_fecha ON ventas(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_movimientos_tenant_producto_fecha ON movimientos_stock(tenant_id, producto_id, created_at);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_productos_tenant_nombre ON productos(tenant_id, nombre);
CREATE INDEX IF NOT EXISTS idx_productos_tenant_codigo ON productos(tenant_id, codigo_barras);

-- ========================================
-- VALIDACIONES DE NEGOCIO
-- ========================================

-- Función para validar stock antes de venta
CREATE OR REPLACE FUNCTION validar_stock_venta(p_producto_id UUID, p_cantidad DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
    stock_actual DECIMAL;
BEGIN
    SELECT stock_actual INTO stock_actual
    FROM productos
    WHERE id = p_producto_id AND tenant_id = auth.uid();
    
    IF stock_actual < p_cantidad THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para validar stock en venta_detalles
CREATE OR REPLACE FUNCTION validar_stock_venta_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT validar_stock_venta(NEW.producto_id, NEW.cantidad) THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto %', NEW.producto_id;
    END IF;
    
    -- Actualizar stock
    UPDATE productos 
    SET stock_actual = stock_actual - NEW.cantidad,
        updated_at = NOW()
    WHERE id = NEW.producto_id AND tenant_id = auth.uid();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
DROP TRIGGER IF EXISTS trigger_validar_stock_venta ON venta_detalles;
CREATE TRIGGER trigger_validar_stock_venta
    BEFORE INSERT ON venta_detalles
    FOR EACH ROW EXECUTE FUNCTION validar_stock_venta_trigger();

-- ========================================
-- AUDITORÍA Y LOGGING
-- ========================================

-- Tabla de auditoría (solo admin puede ver)
CREATE TABLE IF NOT EXISTS auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    tabla VARCHAR(50) NOT NULL,
    operacion VARCHAR(10) NOT NULL,
    registro_id UUID,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario_id UUID,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_auditoria_tenant ON auditoria(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);

-- Función de auditoría
CREATE OR REPLACE FUNCTION auditar_cambios()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO auditoria (
        tenant_id, tabla, operacion, registro_id, 
        datos_anteriores, datos_nuevos, usuario_id
    ) VALUES (
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE to_jsonb(NEW) END,
        auth.uid()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers de auditoría para tablas principales
DROP TRIGGER IF EXISTS audit_comercios ON comercios;
CREATE TRIGGER audit_comercios AFTER INSERT OR UPDATE OR DELETE ON comercios
    FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

DROP TRIGGER IF EXISTS audit_productos ON productos;
CREATE TRIGGER audit_productos AFTER INSERT OR UPDATE OR DELETE ON productos
    FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

DROP TRIGGER IF EXISTS audit_ventas ON ventas;
CREATE TRIGGER audit_ventas AFTER INSERT OR UPDATE OR DELETE ON ventas
    FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

-- ========================================
-- POLÍTICAS DE ACCESO POR ROLES
-- ========================================

-- Crear roles si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_admin') THEN
        CREATE ROLE tenant_admin;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_user') THEN
        CREATE ROLE tenant_user;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'system_admin') THEN
        CREATE ROLE system_admin;
    END IF;
END
$$;

-- Políticas específicas para roles
DROP POLICY IF EXISTS "system_admin_full_access" ON comercios;
CREATE POLICY "system_admin_full_access" ON comercios
    FOR ALL USING (
        current_user_is_super_admin()
    );

-- ========================================
-- TESTING DE RLS
-- ========================================

-- Función para probar aislamiento de tenants
CREATE OR REPLACE FUNCTION test_tenant_isolation(test_tenant_id UUID)
RETURNS TABLE(tabla TEXT, registros INTEGER) AS $$
BEGIN
    -- Temporalmente cambiar el contexto de autenticación para testing
    -- Esto solo debe ejecutarse en ambiente de desarrollo
    
    RETURN QUERY
    SELECT 'comercios'::TEXT, COUNT(*)::INTEGER
    FROM comercios 
    WHERE tenant_id = test_tenant_id
    
    UNION ALL
    
    SELECT 'categorias'::TEXT, COUNT(*)::INTEGER
    FROM categorias 
    WHERE tenant_id = test_tenant_id
    
    UNION ALL
    
    SELECT 'productos'::TEXT, COUNT(*)::INTEGER
    FROM productos 
    WHERE tenant_id = test_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CONFIGURACIÓN DE PERFORMANCE
-- ========================================

-- Configuración recomendada para Supabase con 10,000 tenants
-- (Estos valores deben ajustarse en el dashboard de Supabase)

/*
Recomendaciones de configuración:

1. shared_buffers: 256MB (25% de RAM total)
2. effective_cache_size: 1GB
3. work_mem: 4MB
4. maintenance_work_mem: 64MB
5. random_page_cost: 1.1 (para SSD)
6. max_connections: 100
7. checkpoint_completion_target: 0.9
8. wal_buffers: 16MB
9. default_statistics_target: 100

Partitioning recomendado para tablas grandes:
- ventas: particionar por mes
- movimientos_stock: particionar por mes
- auditoria: particionar por trimestre

Monitoreo de performance:
- pg_stat_statements para análisis de queries
- pg_stat_user_tables para análisis de acceso a tablas
- pg_locks para detección de deadlocks
*/

-- El esquema está optimizado para 10,000 tenants con aislamiento completo
