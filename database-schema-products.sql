-- ========================================
-- TRIKODE INGENIERÍA - TABLAS DE PRODUCTOS
-- Schema para Catálogo Maestro y Productos de Tienda
-- ========================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABLA DE CATALOGO MAESTRO GLOBAL
-- ========================================
CREATE TABLE IF NOT EXISTS productos_maestros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    nombre VARCHAR(100) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    permite_fraccion BOOLEAN DEFAULT false,
    codigo_barras VARCHAR(20),
    precio_costo DECIMAL(12,2),
    precio_venta DECIMAL(12,2),
    stock_actual DECIMAL(12,3) DEFAULT 0,
    stock_minimo DECIMAL(12,3) DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para productos_maestros
CREATE INDEX IF NOT EXISTS idx_productos_maestros_tenant_id ON productos_maestros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_productos_maestros_categoria ON productos_maestros(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_maestros_marca ON productos_maestros(marca);
CREATE INDEX IF NOT EXISTS idx_productos_maestros_nombre ON productos_maestros(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_maestros_codigo_barras ON productos_maestros(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_productos_maestros_activo ON productos_maestros(activo);

-- ========================================
-- TABLA DE PRODUCTOS DE TIENDA (POR TENANT)
-- ========================================
CREATE TABLE IF NOT EXISTS productos_tienda (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    producto_maestro_id UUID REFERENCES productos_maestros(id),
    codigo_barras VARCHAR(20),
    nombre VARCHAR(100) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    permite_fraccion BOOLEAN DEFAULT false,
    stock_actual DECIMAL(12,3) DEFAULT 0,
    stock_minimo DECIMAL(12,3) DEFAULT 0,
    precio_costo DECIMAL(12,2),
    precio_venta DECIMAL(12,2) NOT NULL,
    margen_porcentaje DECIMAL(5,2) DEFAULT 30.00,
    ultimo_precio_costo DECIMAL(12,2),
    ultimo_precio_venta DECIMAL(12,2),
    fecha_ultima_actualizacion_precio TIMESTAMP WITH TIME ZONE,
    activo BOOLEAN DEFAULT true,
    observaciones TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para productos_tienda
CREATE INDEX IF NOT EXISTS idx_productos_tienda_tenant_id ON productos_tienda(tenant_id);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_producto_maestro_id ON productos_tienda(producto_maestro_id);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_categoria ON productos_tienda(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_marca ON productos_tienda(marca);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_nombre ON productos_tienda(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_codigo_barras ON productos_tienda(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_activo ON productos_tienda(activo);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_stock_bajo ON productos_tienda(tenant_id, stock_actual, stock_minimo) WHERE stock_actual <= stock_minimo;

-- ========================================
-- TABLA DE ACTUALIZACIONES DE PRECIOS (HISTORIAL)
-- ========================================
CREATE TABLE IF NOT EXISTS actualizaciones_precios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    tipo_actualizacion VARCHAR(20) NOT NULL, -- 'INDIVIDUAL', 'MASIVA_MARCA', 'MASIVA_CATEGORIA'
    producto_id UUID REFERENCES productos_tienda(id),
    marca VARCHAR(50),
    categoria VARCHAR(50),
    porcentaje_aumento DECIMAL(5,2),
    precio_anterior DECIMAL(12,2),
    precio_nuevo DECIMAL(12,2),
    motivo TEXT,
    usuario_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para actualizaciones_precios
CREATE INDEX IF NOT EXISTS idx_actualizaciones_precios_tenant_id ON actualizaciones_precios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_actualizaciones_precios_producto_id ON actualizaciones_precios(producto_id);
CREATE INDEX IF NOT EXISTS idx_actualizaciones_precios_tipo_actualizacion ON actualizaciones_precios(tipo_actualizacion);
CREATE INDEX IF NOT EXISTS idx_actualizaciones_precios_created_at ON actualizaciones_precios(created_at);

-- ========================================
-- VISTAS ÚTILES
-- ========================================

-- Vista de productos con bajo stock por tenant
DROP VIEW IF EXISTS productos_bajo_stock;
CREATE OR REPLACE VIEW productos_bajo_stock WITH (security_invoker = true) AS
SELECT 
    pt.*,
    CASE 
        WHEN pt.stock_actual <= pt.stock_minimo THEN true 
        ELSE false 
    END as alerta_stock,
    pt.stock_minimo - pt.stock_actual as stock_faltante
FROM productos_tienda pt
WHERE pt.activo = true AND pt.stock_actual <= pt.stock_minimo;

-- Vista de catálogo maestro disponible para importar
DROP VIEW IF EXISTS catalogo_disponible;
CREATE OR REPLACE VIEW catalogo_disponible WITH (security_invoker = true) AS
SELECT 
    pm.*,
    CASE 
        WHEN pt.id IS NULL THEN true
        ELSE false
    END as disponible_para_importar
FROM productos_maestros pm
LEFT JOIN productos_tienda pt ON pm.id = pt.producto_maestro_id AND pt.tenant_id = '00000000-0000-0000-0000-000000000000'
WHERE pm.activo = true;

-- Compatibilidad para entornos existentes: asegurar default UUID válido.
ALTER TABLE productos_maestros
    ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- Vista de margenes de ganancia por tenant
DROP VIEW IF EXISTS margenes_ganancia;
CREATE OR REPLACE VIEW margenes_ganancia WITH (security_invoker = true) AS
SELECT 
    tenant_id,
    categoria,
    marca,
    AVG((precio_venta - precio_costo) / precio_costo * 100) as margen_promedio,
    SUM(precio_venta - precio_costo) as ganancia_total,
    COUNT(*) as cantidad_productos
FROM productos_tienda
WHERE activo = true AND precio_costo > 0
GROUP BY tenant_id, categoria, marca;

-- ========================================
-- FUNCIONES Y TRIGGERS
-- ========================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para productos_maestros
DROP TRIGGER IF EXISTS update_productos_maestros_updated_at ON productos_maestros;
CREATE TRIGGER update_productos_maestros_updated_at 
    BEFORE UPDATE ON productos_maestros 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para productos_tienda
DROP TRIGGER IF EXISTS update_productos_tienda_updated_at ON productos_tienda;
CREATE TRIGGER update_productos_tienda_updated_at 
    BEFORE UPDATE ON productos_tienda 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para registrar actualización de precios
CREATE OR REPLACE FUNCTION registrar_actualizacion_precio()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo si cambió el precio_venta
    IF OLD.precio_venta != NEW.precio_venta THEN
        INSERT INTO actualizaciones_precios (
            tenant_id,
            tipo_actualizacion,
            producto_id,
            marca,
            categoria,
            precio_anterior,
            precio_nuevo,
            motivo,
            metadata
        ) VALUES (
            NEW.tenant_id,
            'INDIVIDUAL',
            NEW.id,
            NEW.marca,
            NEW.categoria,
            OLD.precio_venta,
            NEW.precio_venta,
            'Actualización individual',
            jsonb_build_object(
                'precio_costo_anterior', OLD.precio_costo,
                'precio_costo_nuevo', NEW.precio_costo,
                'margen_anterior', CASE WHEN OLD.precio_costo > 0 THEN ((OLD.precio_venta - OLD.precio_costo) / OLD.precio_costo * 100) ELSE NULL END,
                'margen_nuevo', CASE WHEN NEW.precio_costo > 0 THEN ((NEW.precio_venta - NEW.precio_costo) / NEW.precio_costo * 100) ELSE NULL END
            )
        );
        
        -- Actualizar fecha de última actualización de precio
        NEW.fecha_ultima_actualizacion_precio = NOW();
        NEW.ultimo_precio_venta = OLD.precio_venta;
    END IF;
    
    -- También registrar si cambió el precio_costo
    IF OLD.precio_costo != NEW.precio_costo THEN
        NEW.ultimo_precio_costo = OLD.precio_costo;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar actualizaciones de precios
DROP TRIGGER IF EXISTS trigger_actualizacion_precio ON productos_tienda;
CREATE TRIGGER trigger_actualizacion_precio
    BEFORE UPDATE ON productos_tienda
    FOR EACH ROW EXECUTE FUNCTION registrar_actualizacion_precio();

-- ========================================
-- FUNCIONES DE ACTUALIZACIÓN MASIVA
-- ========================================

-- Función para actualizar precios por marca
CREATE OR REPLACE FUNCTION actualizar_precios_por_marca(
    p_tenant_id UUID,
    p_marca VARCHAR(50),
    p_porcentaje DECIMAL(5,2),
    p_motivo TEXT DEFAULT 'Actualización masiva por marca'
)
RETURNS INTEGER AS $$
DECLARE
    productos_actualizados INTEGER := 0;
    producto_record RECORD;
BEGIN
    -- Actualizar todos los productos de la marca
    FOR producto_record IN 
        SELECT id, precio_venta, precio_costo
        FROM productos_tienda
        WHERE tenant_id = p_tenant_id 
        AND marca = p_marca 
        AND activo = true
    LOOP
        -- Calcular nuevo precio
        DECLARE nuevo_precio DECIMAL(12,2);
        BEGIN
            nuevo_precio := producto_record.precio_venta * (1 + p_porcentaje / 100);
            
            -- Actualizar precio
            UPDATE productos_tienda
            SET 
                precio_venta = nuevo_precio,
                fecha_ultima_actualizacion_precio = NOW()
            WHERE id = producto_record.id;
            
            -- Registrar en historial
            INSERT INTO actualizaciones_precios (
                tenant_id,
                tipo_actualizacion,
                producto_id,
                marca,
                categoria,
                porcentaje_aumento,
                precio_anterior,
                precio_nuevo,
                motivo
            ) VALUES (
                p_tenant_id,
                'MASIVA_MARCA',
                producto_record.id,
                p_marca,
                NULL,
                p_porcentaje,
                producto_record.precio_venta,
                nuevo_precio,
                p_motivo
            );
            
            productos_actualizados := productos_actualizados + 1;
        EXCEPTION
            WHEN OTHERS THEN
                -- Continuar con el siguiente producto si hay error
                CONTINUE;
        END;
    END LOOP;
    
    RETURN productos_actualizados;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar precios por categoría
CREATE OR REPLACE FUNCTION actualizar_precios_por_categoria(
    p_tenant_id UUID,
    p_categoria VARCHAR(50),
    p_porcentaje DECIMAL(5,2),
    p_motivo TEXT DEFAULT 'Actualización masiva por categoría'
)
RETURNS INTEGER AS $$
DECLARE
    productos_actualizados INTEGER := 0;
    producto_record RECORD;
BEGIN
    -- Actualizar todos los productos de la categoría
    FOR producto_record IN 
        SELECT id, precio_venta, precio_costo, categoria
        FROM productos_tienda
        WHERE tenant_id = p_tenant_id 
        AND categoria = p_categoria 
        AND activo = true
    LOOP
        -- Calcular nuevo precio
        DECLARE nuevo_precio DECIMAL(12,2);
        BEGIN
            nuevo_precio := producto_record.precio_venta * (1 + p_porcentaje / 100);
            
            -- Actualizar precio
            UPDATE productos_tienda
            SET 
                precio_venta = nuevo_precio,
                fecha_ultima_actualizacion_precio = NOW()
            WHERE id = producto_record.id;
            
            -- Registrar en historial
            INSERT INTO actualizaciones_precios (
                tenant_id,
                tipo_actualizacion,
                producto_id,
                marca,
                categoria,
                porcentaje_aumento,
                precio_anterior,
                precio_nuevo,
                motivo
            ) VALUES (
                p_tenant_id,
                'MASIVA_CATEGORIA',
                producto_record.id,
                NULL,
                producto_record.categoria,
                p_porcentaje,
                producto_record.precio_venta,
                nuevo_precio,
                p_motivo
            );
            
            productos_actualizados := productos_actualizados + 1;
        EXCEPTION
            WHEN OTHERS THEN
                -- Continuar con el siguiente producto si hay error
                CONTINUE;
        END;
    END LOOP;
    
    RETURN productos_actualizados;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE productos_maestros ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_tienda ENABLE ROW LEVEL SECURITY;
ALTER TABLE actualizaciones_precios ENABLE ROW LEVEL SECURITY;

-- Política para productos_maestros (solo lectura para todos, escritura para admin)
DROP POLICY IF EXISTS "Todos pueden ver productos_maestros" ON productos_maestros;
CREATE POLICY "Todos pueden ver productos_maestros" ON productos_maestros
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Solo admin puede modificar productos_maestros" ON productos_maestros;
CREATE POLICY "Solo admin puede modificar productos_maestros" ON productos_maestros
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Política para productos_tienda (por tenant)
DROP POLICY IF EXISTS "Usuarios solo pueden ver sus productos" ON productos_tienda;
CREATE POLICY "Usuarios solo pueden ver sus productos" ON productos_tienda
    FOR ALL USING (auth.uid() = tenant_id);

-- Política para actualizaciones_precios (por tenant)
DROP POLICY IF EXISTS "Usuarios solo pueden ver sus actualizaciones" ON actualizaciones_precios;
CREATE POLICY "Usuarios solo pueden ver sus actualizaciones" ON actualizaciones_precios
    FOR ALL USING (auth.uid() = tenant_id);

-- ========================================
-- COMENTARIOS
-- ========================================

COMMENT ON TABLE productos_maestros IS 'Catálogo maestro global de productos (500+ SKUs)';
COMMENT ON TABLE productos_tienda IS 'Productos específicos de cada tienda (tenant)';
COMMENT ON TABLE actualizaciones_precios IS 'Historial de actualizaciones de precios';

-- El esquema está listo para soportar 10,000 tenants con catálogo maestro compartido
-- y productos individuales por tienda con control de precios y stock
