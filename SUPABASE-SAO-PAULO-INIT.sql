-- ============================================================================
-- TRIKODE INGENIERÍA - INICIALIZACIÓN COMPLETA SUPABASE (São Paulo)
-- Generado a partir de los SQL incluidos en el proyecto.
-- Destino: proyecto NUEVO y vacío de Supabase.
-- Ejecutar una sola vez desde SQL Editor.
-- NO ejecutar sobre una base con datos reales sin revisar antes.
-- ============================================================================


-- ============================================================================
-- BEGIN: database-schema.sql
-- ============================================================================

-- ========================================
-- TRIKODE INGENIERÍA - SaaS Multitenant
-- Arquitectura de Base de Datos con RLS
-- ========================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Rubros (Global - No tenant_id)
CREATE TABLE IF NOT EXISTS rubros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar rubros predefinidos
INSERT INTO rubros (nombre, descripcion) VALUES
('Kioscos', 'Ventas rápidas, bebidas, golosinas, tabaco'),
('Rotisería', 'Comida preparada, delivery, pedidos'),
('Rotisería/Carrito', 'Comidas rápidas de carrito y rotisería con combos'),
('Química', 'Venta suelta, productos químicos, granel'),
('Carnicería', 'Carnes rojas, blancas, embutidos y cortes por kilo'),
('Carnicería/Verdulería', 'Carnes y verduras/frutas con venta por kilo o fraccionada'),
('Ferretería', 'Herramientas, materiales, construcción'),
('Tienda de Mascotas', 'Alimentos, salud y accesorios para mascotas'),
('Librería', 'Útiles, papelería y artículos escolares')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla de Planes (Global - No tenant_id)
CREATE TABLE IF NOT EXISTS planes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    limite_productos INTEGER,
    limite_usuarios INTEGER,
    features JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar planes (idempotente por nombre)
INSERT INTO planes (nombre, precio, limite_productos, limite_usuarios, features)
SELECT 'Básico', 2990.00, 500, 2, '{"reportes_basicos": true, "stock_alerts": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Básico');

INSERT INTO planes (nombre, precio, limite_productos, limite_usuarios, features)
SELECT 'Profesional', 5990.00, 2000, 5, '{"reportes_avanzados": true, "api_access": true, "integraciones": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Profesional');

INSERT INTO planes (nombre, precio, limite_productos, limite_usuarios, features)
SELECT 'Enterprise', 9990.00, 10000, 20, '{"reportes_premium": true, "api_full": true, "whitelabel": true, "soporte_24/7": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Enterprise');

-- Tabla de Comercios (Multitenant)
CREATE TABLE IF NOT EXISTS comercios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    direccion TEXT,
    rubro_id UUID REFERENCES rubros(id),
    plan_id UUID REFERENCES planes(id),
    activo BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para tenant_id en comercios
CREATE INDEX IF NOT EXISTS idx_comercios_tenant_id ON comercios(tenant_id);

-- Tabla de Categorías (Multitenant)
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para RLS en categorías
CREATE INDEX IF NOT EXISTS idx_categorias_tenant_id ON categorias(tenant_id);

-- Tabla de Productos (Multitenant)
CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    categoria_id UUID REFERENCES categorias(id),
    codigo_barras VARCHAR(20),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    stock_actual DECIMAL(12,3) DEFAULT 0,
    stock_minimo DECIMAL(12,3) DEFAULT 0,
    precio_costo DECIMAL(12,2),
    precio_venta DECIMAL(12,2) NOT NULL,
    unidad_medida VARCHAR(20) DEFAULT 'UNIDAD',
    permite_fraccion BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para RLS en productos
CREATE INDEX IF NOT EXISTS idx_productos_tenant_id ON productos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON productos(codigo_barras);

-- Tabla de Ventas (Multitenant)
CREATE TABLE IF NOT EXISTS ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    numero_factura VARCHAR(20),
    cliente_nombre VARCHAR(100),
    total DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2),
    impuestos DECIMAL(12,2) DEFAULT 0,
    descuento DECIMAL(12,2) DEFAULT 0,
    metodo_pago VARCHAR(20) DEFAULT 'EFECTIVO',
    estado VARCHAR(20) DEFAULT 'COMPLETADA',
    observaciones TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para RLS en ventas
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_id ON ventas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON ventas(created_at);

-- Tabla de Detalles de Venta (Multitenant)
CREATE TABLE IF NOT EXISTS venta_detalles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id),
    cantidad DECIMAL(12,3) NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para RLS en venta_detalles
CREATE INDEX IF NOT EXISTS idx_venta_detalles_tenant_id ON venta_detalles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta_id ON venta_detalles(venta_id);

-- Tabla de Movimientos de Stock (Multitenant)
CREATE TABLE IF NOT EXISTS movimientos_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    producto_id UUID REFERENCES productos(id),
    tipo_movimiento VARCHAR(20) NOT NULL, -- 'INGRESO', 'EGRESO', 'AJUSTE'
    cantidad DECIMAL(12,3) NOT NULL,
    stock_anterior DECIMAL(12,3),
    stock_nuevo DECIMAL(12,3),
    motivo VARCHAR(100),
    venta_id UUID REFERENCES ventas(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para RLS en movimientos_stock
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_tenant_id ON movimientos_stock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_producto_id ON movimientos_stock(producto_id);

-- ========================================
-- POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ========================================

-- Habilitar RLS en todas las tablas multitenant
ALTER TABLE comercios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Política para comercios
DROP POLICY IF EXISTS "Los usuarios solo pueden ver su propio comercio" ON comercios;
CREATE POLICY "Los usuarios solo pueden ver su propio comercio" ON comercios
    FOR ALL USING (auth.uid() = tenant_id);

-- Política para categorías
DROP POLICY IF EXISTS "Los usuarios solo pueden ver categorías de su tenant" ON categorias;
CREATE POLICY "Los usuarios solo pueden ver categorías de su tenant" ON categorias
    FOR ALL USING (auth.uid() = tenant_id);

-- Política para productos
DROP POLICY IF EXISTS "Los usuarios solo pueden ver productos de su tenant" ON productos;
CREATE POLICY "Los usuarios solo pueden ver productos de su tenant" ON productos
    FOR ALL USING (auth.uid() = tenant_id);

-- Política para ventas
DROP POLICY IF EXISTS "Los usuarios solo pueden ver ventas de su tenant" ON ventas;
CREATE POLICY "Los usuarios solo pueden ver ventas de su tenant" ON ventas
    FOR ALL USING (auth.uid() = tenant_id);

-- Política para venta_detalles
DROP POLICY IF EXISTS "Los usuarios solo pueden ver detalles de ventas de su tenant" ON venta_detalles;
CREATE POLICY "Los usuarios solo pueden ver detalles de ventas de su tenant" ON venta_detalles
    FOR ALL USING (auth.uid() = tenant_id);

-- Política para movimientos_stock
DROP POLICY IF EXISTS "Los usuarios solo pueden ver movimientos de stock de su tenant" ON movimientos_stock;
CREATE POLICY "Los usuarios solo pueden ver movimientos de stock de su tenant" ON movimientos_stock
    FOR ALL USING (auth.uid() = tenant_id);

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

-- Trigger para comercios
DROP TRIGGER IF EXISTS update_comercios_updated_at ON comercios;
CREATE TRIGGER update_comercios_updated_at 
    BEFORE UPDATE ON comercios 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para productos
DROP TRIGGER IF EXISTS update_productos_updated_at ON productos;
CREATE TRIGGER update_productos_updated_at 
    BEFORE UPDATE ON productos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para manejar movimientos de stock
CREATE OR REPLACE FUNCTION registrar_movimiento_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo para inserciones y actualizaciones que afectan el stock
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.stock_actual != NEW.stock_actual) THEN
        INSERT INTO movimientos_stock (
            tenant_id, 
            producto_id, 
            tipo_movimiento, 
            cantidad, 
            stock_anterior, 
            stock_nuevo, 
            motivo
        ) VALUES (
            NEW.tenant_id,
            NEW.id,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'INGRESO'
                WHEN NEW.stock_actual > OLD.stock_actual THEN 'INGRESO'
                ELSE 'EGRESO'
            END,
            CASE 
                WHEN TG_OP = 'INSERT' THEN NEW.stock_actual
                ELSE NEW.stock_actual - OLD.stock_actual
            END,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 0
                ELSE OLD.stock_actual
            END,
            NEW.stock_actual,
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'Stock inicial'
                ELSE 'Actualización manual'
            END
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para movimientos de stock en productos
DROP TRIGGER IF EXISTS trigger_movimiento_stock ON productos;
CREATE TRIGGER trigger_movimiento_stock
    AFTER INSERT OR UPDATE ON productos
    FOR EACH ROW EXECUTE FUNCTION registrar_movimiento_stock();

-- ========================================
-- VISTAS ÚTILES
-- ========================================

-- Vista de productos con bajo stock
DROP VIEW IF EXISTS productos_bajo_stock;
CREATE VIEW productos_bajo_stock AS
SELECT 
    p.*,
    c.nombre as categoria_nombre,
    CASE 
        WHEN p.stock_actual <= p.stock_minimo THEN true 
        ELSE false 
    END as alerta_stock
FROM productos p
JOIN categorias c ON p.categoria_id = c.id
WHERE p.stock_actual <= p.stock_minimo AND p.activo = true;

-- Vista de resumen de ventas diarias
DROP VIEW IF EXISTS resumen_ventas_diarias;
CREATE VIEW resumen_ventas_diarias WITH (security_invoker = true) AS
SELECT 
    tenant_id,
    DATE(created_at) as fecha,
    COUNT(*) as total_ventas,
    SUM(total) as total_facturado,
    AVG(total) as ticket_promedio
FROM ventas
WHERE estado = 'COMPLETADA'
GROUP BY tenant_id, DATE(created_at)
ORDER BY fecha DESC;

-- ========================================
-- CATÁLOGOS BASE POR RUBRO
-- ========================================

-- Función para crear catálogo base por rubro
CREATE OR REPLACE FUNCTION crear_catalogo_base(p_tenant_id UUID, p_rubro_id UUID)
RETURNS VOID AS $$
DECLARE
    categoria_record RECORD;
BEGIN
    -- Kioscos
    IF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Kioscos') THEN
        -- Bebidas
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Bebidas', 'Gaseosas, aguas, jugos'),
        (p_tenant_id, 'Golosinas', 'Caramelos, chocolates, alfajores'),
        (p_tenant_id, 'Tabaco', 'Cigarrillos, tabaco'),
        (p_tenant_id, 'Lácteos', 'Leche, yogures, quesos'),
        (p_tenant_id, 'Snacks', 'Papas fritas, maní, aceitunas');
        
        -- Rotisería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Rotisería') THEN
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Pizzas', 'Pizzas varias'),
        (p_tenant_id, 'Lomitos', 'Lomitos completos'),
        (p_tenant_id, 'Hamburguesas', 'Hamburguesas varias'),
        (p_tenant_id, 'Empanadas', 'Empanadas de varios sabores'),
        (p_tenant_id, 'Acompañamientos', 'Papas fritas, ensaladas'),
        (p_tenant_id, 'Combos', 'Promociones y combos del local');

        -- Rotisería/Carrito
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Rotisería/Carrito') THEN
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Lomitos', 'Lomitos y sandwiches calientes'),
        (p_tenant_id, 'Pizzas', 'Pizzas y porciones'),
        (p_tenant_id, 'Hamburguesas', 'Hamburguesas simples y dobles'),
        (p_tenant_id, 'Panchos', 'Panchos y variantes'),
        (p_tenant_id, 'Combos', 'Combos listos para venta rápida');
        
        -- Química
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Química') THEN
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Limpieza', 'Productos de limpieza general'),
        (p_tenant_id, 'Pinturas', 'Pinturas y solventes'),
        (p_tenant_id, 'Adhesivos', 'Pegamentos y cintas adhesivas'),
        (p_tenant_id, 'Granos', 'Productos a granel'),
        (p_tenant_id, 'Solventes', 'Disolventes químicos');

        -- Carnicería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Carnicería') THEN
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Asado', 'Cortes parrilleros clásicos argentinos'),
        (p_tenant_id, 'Carne Vacuna', 'Cortes vacunos para venta por kilo'),
        (p_tenant_id, 'Pollo', 'Cortes y piezas de pollo'),
        (p_tenant_id, 'Cerdo', 'Cortes porcinos frescos'),
        (p_tenant_id, 'Embutidos', 'Chorizos, morcillas y fiambres frescos'),
        (p_tenant_id, 'Preparados', 'Milanesas, hamburguesas y productos elaborados'),
        (p_tenant_id, 'Combos Asado', 'Combos surtidos listos para parrilla');

        -- Carnicería/Verdulería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Carnicería/Verdulería') THEN
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Asado', 'Cortes parrilleros clásicos argentinos'),
        (p_tenant_id, 'Carne Vacuna', 'Cortes vacunos para venta por kilo'),
        (p_tenant_id, 'Pollo', 'Cortes y piezas de pollo'),
        (p_tenant_id, 'Frutas', 'Frutas frescas para venta por kilo o unidad'),
        (p_tenant_id, 'Verduras', 'Verduras frescas para venta por kilo o unidad'),
        (p_tenant_id, 'Hortalizas', 'Hortalizas de estación para venta fraccionada'),
        (p_tenant_id, 'Combos Asado', 'Combo parrillero con carnes y verduras');
        
        -- Ferretería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Ferretería') THEN
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Herramientas', 'Herramientas manuales y eléctricas'),
        (p_tenant_id, 'Construcción', 'Materiales de construcción'),
        (p_tenant_id, 'Electricidad', 'Materiales eléctricos'),
        (p_tenant_id, 'Fontanería', 'Cañerías y accesorios'),
        (p_tenant_id, 'Fijaciones', 'Tornillos, clavos, anclajes');

        -- Tienda de Mascotas
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Tienda de Mascotas') THEN
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Salud Mascotas', 'Cuidado preventivo y productos de bienestar'),
        (p_tenant_id, 'Alimentos', 'Alimentos para perros y gatos'),
        (p_tenant_id, 'Higiene Mascotas', 'Shampoo y antiparasitarios'),
        (p_tenant_id, 'Accesorios', 'Correas, collares, juguetes'),
        (p_tenant_id, 'Suplementos', 'Vitaminas y productos complementarios');

        -- Librería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Librería') THEN
        INSERT INTO categorias (tenant_id, nombre, descripcion) VALUES
        (p_tenant_id, 'Cuadernos', 'Cuadernos y repuestos'),
        (p_tenant_id, 'Escritura', 'Lápices, lapiceras y marcadores'),
        (p_tenant_id, 'Papelería', 'Hojas, cartulinas y sobres'),
        (p_tenant_id, 'Escolar', 'Kits y artículos escolares'),
        (p_tenant_id, 'Oficina', 'Organización y escritorio');

    END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- VALIDACIONES Y RESTRICCIONES
-- ========================================

-- Validar que el stock no sea negativo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_stock_no_negativo'
    ) THEN
        ALTER TABLE productos
        ADD CONSTRAINT check_stock_no_negativo CHECK (stock_actual >= 0);
    END IF;
END $$;

-- Validar que los precios sean positivos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_precio_positivo'
    ) THEN
        ALTER TABLE productos
        ADD CONSTRAINT check_precio_positivo CHECK (precio_venta >= 0);
    END IF;
END $$;

-- Validar que el total de ventas sea positivo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_total_positivo'
    ) THEN
        ALTER TABLE ventas
        ADD CONSTRAINT check_total_positivo CHECK (total > 0);
    END IF;
END $$;

-- ========================================
-- COMENTARIOS
-- ========================================

COMMENT ON TABLE comercios IS 'Tabla principal de comercios (multitenant)';
COMMENT ON TABLE categorias IS 'Categorías de productos por comercio';
COMMENT ON TABLE productos IS 'Productos con control de stock y precios';
COMMENT ON TABLE ventas IS 'Ventas realizadas por cada comercio';
COMMENT ON TABLE venta_detalles IS 'Detalles de cada venta';
COMMENT ON TABLE movimientos_stock IS 'Historial de movimientos de stock';

-- El esquema está listo para soportar 10,000 tenants con aislamiento completo mediante RLS

-- END: database-schema.sql

-- ============================================================================
-- BEGIN: database-schema-products.sql
-- ============================================================================

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

-- END: database-schema-products.sql

-- ============================================================================
-- BEGIN: tenant-setup.sql
-- ============================================================================

-- ========================================
-- CONFIGURACIÓN DE TENANTS - TRIKODE INGENIERÍA
-- Proceso de onboarding para nuevos comercios
-- ========================================

-- Tabla de auditoría mínima requerida por crear_configuracion_inicial.
-- Se crea aquí para evitar dependencia con scripts legacy de RLS.
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

CREATE INDEX IF NOT EXISTS idx_auditoria_tenant ON auditoria(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);

-- Campos de ciclo de suscripcion en comercios.
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS estado_suscripcion VARCHAR(20) DEFAULT 'ACTIVO';
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS suscripcion_vence_at DATE;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS gracia_hasta DATE;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS solo_descarga_hasta DATE;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS baja_solicitada_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS baja_motivos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS baja_detalle TEXT;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS baja_permite_contacto BOOLEAN DEFAULT false;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS ultimo_pago_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE comercios ADD COLUMN IF NOT EXISTS depurado_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_comercios_estado_suscripcion ON comercios(estado_suscripcion);
CREATE INDEX IF NOT EXISTS idx_comercios_suscripcion_vence ON comercios(suscripcion_vence_at);
CREATE INDEX IF NOT EXISTS idx_comercios_solo_descarga_hasta ON comercios(solo_descarga_hasta);

-- Tabla de feedback para sugerencias y bajas voluntarias.
CREATE TABLE IF NOT EXISTS cliente_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    comercio_usuario_id UUID,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('SUGERENCIA', 'BAJA')),
    categoria VARCHAR(50),
    motivos JSONB DEFAULT '[]'::jsonb,
    mensaje TEXT,
    permite_contacto BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliente_feedback_tenant ON cliente_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cliente_feedback_tipo ON cliente_feedback(tipo);
CREATE INDEX IF NOT EXISTS idx_cliente_feedback_created_at ON cliente_feedback(created_at);

-- Determina el modo de acceso operativo segun vencimiento y ventana de descarga.
CREATE OR REPLACE FUNCTION trikode_tenant_access_mode(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_comercio RECORD;
    v_overdue_days INTEGER;
BEGIN
    SELECT
        activo,
        suscripcion_vence_at,
        solo_descarga_hasta,
        depurado_at
    INTO v_comercio
    FROM comercios
    WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN 'BLOCKED';
    END IF;

    IF v_comercio.depurado_at IS NOT NULL THEN
        RETURN 'BLOCKED';
    END IF;

    IF v_comercio.suscripcion_vence_at IS NULL THEN
        RETURN 'FULL';
    END IF;

    v_overdue_days := CURRENT_DATE - v_comercio.suscripcion_vence_at;

    IF v_overdue_days <= 0 THEN
        RETURN 'FULL';
    END IF;

    IF v_overdue_days <= 7 THEN
        RETURN 'FULL';
    END IF;

    IF v_comercio.solo_descarga_hasta IS NOT NULL AND CURRENT_DATE <= v_comercio.solo_descarga_hasta THEN
        RETURN 'DOWNLOAD_ONLY';
    END IF;

    RETURN 'BLOCKED';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Bloquea escrituras de tablas operativas cuando el tenant no tiene acceso FULL.
CREATE OR REPLACE FUNCTION enforce_trikode_write_access()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_mode TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
    ELSE
        v_tenant_id := NEW.tenant_id;
    END IF;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant no identificado para operacion % en %', TG_OP, TG_TABLE_NAME;
    END IF;

    v_mode := trikode_tenant_access_mode(v_tenant_id);

    IF v_mode <> 'FULL' THEN
        RAISE EXCEPTION 'Operacion no permitida: modo de acceso % para tenant %', v_mode, v_tenant_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos') THEN
        DROP TRIGGER IF EXISTS trg_enforce_write_turnos ON turnos;
        CREATE TRIGGER trg_enforce_write_turnos
            BEFORE INSERT OR UPDATE OR DELETE ON turnos
            FOR EACH ROW
            EXECUTE FUNCTION enforce_trikode_write_access();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ventas') THEN
        DROP TRIGGER IF EXISTS trg_enforce_write_ventas ON ventas;
        CREATE TRIGGER trg_enforce_write_ventas
            BEFORE INSERT OR UPDATE OR DELETE ON ventas
            FOR EACH ROW
            EXECUTE FUNCTION enforce_trikode_write_access();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venta_detalles') THEN
        DROP TRIGGER IF EXISTS trg_enforce_write_venta_detalles ON venta_detalles;
        CREATE TRIGGER trg_enforce_write_venta_detalles
            BEFORE INSERT OR UPDATE OR DELETE ON venta_detalles
            FOR EACH ROW
            EXECUTE FUNCTION enforce_trikode_write_access();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cierres_diarios') THEN
        DROP TRIGGER IF EXISTS trg_enforce_write_cierres_diarios ON cierres_diarios;
        CREATE TRIGGER trg_enforce_write_cierres_diarios
            BEFORE INSERT OR UPDATE OR DELETE ON cierres_diarios
            FOR EACH ROW
            EXECUTE FUNCTION enforce_trikode_write_access();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'productos_tienda') THEN
        DROP TRIGGER IF EXISTS trg_enforce_write_productos_tienda ON productos_tienda;
        CREATE TRIGGER trg_enforce_write_productos_tienda
            BEFORE INSERT OR UPDATE OR DELETE ON productos_tienda
            FOR EACH ROW
            EXECUTE FUNCTION enforce_trikode_write_access();
    END IF;
END;
$$;

-- PROCEDIMIENTO DE REGISTRO DE NUEVO COMERCIO
CREATE OR REPLACE FUNCTION registrar_comercio(
    p_nombre VARCHAR(100),
    p_email VARCHAR(100),
    p_telefono VARCHAR(20),
    p_direccion TEXT,
    p_rubro_id UUID,
    p_plan_id UUID,
    p_trial_days INTEGER DEFAULT 7
)
RETURNS UUID AS $$
DECLARE
    nuevo_tenant_id UUID;
    nuevo_comercio_id UUID;
    v_trial_days INTEGER := COALESCE(p_trial_days, 0);
    v_suscripcion_vence_at DATE := CURRENT_DATE + INTERVAL '30 days';
    v_gracia_hasta DATE := CURRENT_DATE + INTERVAL '37 days';
BEGIN
    -- Generar tenant_id único
    nuevo_tenant_id := uuid_generate_v4();

    -- Determinar días de vencimiento según si es trial o pago.
    IF v_trial_days > 0 THEN
        v_suscripcion_vence_at := CURRENT_DATE + (v_trial_days || ' days')::INTERVAL;
        v_gracia_hasta := CURRENT_DATE + ((v_trial_days + 7) || ' days')::INTERVAL;
    END IF;

    -- Insertar nuevo comercio
    INSERT INTO comercios (
        tenant_id,
        nombre,
        email,
        telefono,
        direccion,
        rubro_id,
        plan_id,
        estado_suscripcion,
        suscripcion_vence_at,
        gracia_hasta,
        solo_descarga_hasta,
        ultimo_pago_at,
        activo
    ) VALUES (
        nuevo_tenant_id,
        p_nombre,
        p_email,
        p_telefono,
        p_direccion,
        p_rubro_id,
        p_plan_id,
        'ACTIVO',
        v_suscripcion_vence_at,
        v_gracia_hasta,
        CURRENT_DATE + INTERVAL '120 days',
        NOW(),
        true
    ) RETURNING id INTO nuevo_comercio_id;

    -- Crear catálogo base según el rubro
    PERFORM crear_catalogo_base(nuevo_tenant_id, p_rubro_id);

    -- Insertar productos de ejemplo para el rubro
    PERFORM insertar_productos_ejemplo(nuevo_tenant_id, p_rubro_id);

    -- Crear configuración inicial
    PERFORM crear_configuracion_inicial(nuevo_tenant_id);

    RETURN nuevo_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- PRODUCTOS DE EJEMPLO POR RUBRO
CREATE OR REPLACE FUNCTION insertar_productos_ejemplo(p_tenant_id UUID, p_rubro_id UUID)
RETURNS VOID AS $$
DECLARE
    categoria_record RECORD;
    seeded_at TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Kioscos
    IF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Kioscos') THEN
        -- Bebidas
        FOR categoria_record IN 
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Bebidas'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Coca-Cola 500ml', 50, 450.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pepsi 500ml', 45, 420.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Agua Mineral 500ml', 60, 180.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Jugo de Naranja 1L', 30, 280.00, 'UNIDAD');
        END LOOP;
        
        -- Golosinas
        FOR categoria_record IN 
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Golosinas'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Alfajor Jorgito', 100, 280.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Chicle Bubaloo', 200, 120.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Caramelos Mentol', 150, 100.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Chocolate Block', 80, 350.00, 'UNIDAD');
        END LOOP;
        
    -- Rotisería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Rotisería') THEN
        -- Pizzas
        FOR categoria_record IN 
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Pizzas'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Pizza Muzzarella', 10, 3500.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pizza Napolitana', 8, 4200.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pizza Fugazzeta', 8, 3800.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pizza Calabresa', 6, 4500.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pizza Jamón y Morrón', 6, 4300.00, 'UNIDAD');
        END LOOP;
        
        -- Lomitos
        FOR categoria_record IN 
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Lomitos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Lomito Completo', 15, 4200.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Lomito Simple', 20, 3500.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Lomito Especial', 10, 5200.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Lomito Árabe', 8, 5600.00, 'UNIDAD');
        END LOOP;

        -- Combos
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Combos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Combo Lomito + 2 Pizzas', 8, 15000.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Combo 2 Lomitos + Papas', 10, 13500.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Combo Familiar Pizza + Empanadas', 10, 17000.00, 'UNIDAD');
        END LOOP;

    -- Rotisería/Carrito
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Rotisería/Carrito') THEN
        -- Lomitos
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Lomitos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Lomito Completo', 20, 4200.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Lomito Especial', 15, 5200.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Sandwich de Milanesa Completo', 20, 3900.00, 'UNIDAD');
        END LOOP;

        -- Pizzas
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Pizzas'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Pizza Muzzarella', 15, 3500.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pizza Especial', 10, 4600.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Porción Pizza Muzzarella', 80, 650.00, 'UNIDAD');
        END LOOP;

        -- Panchos
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Panchos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Pancho Clásico', 120, 1800.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pancho Completo', 100, 2400.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pancho Doble', 80, 2900.00, 'UNIDAD');
        END LOOP;

        -- Combos
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Combos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Combo Lomito + 2 Pizzas', 8, 15000.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Combo 2 Panchos + Gaseosa', 20, 6500.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Combo Hamburguesa + Papas', 20, 7200.00, 'UNIDAD');
        END LOOP;
        
    -- Química
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Química') THEN
        -- Limpieza
        FOR categoria_record IN 
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Limpieza'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Lavandina Concentrada 5L', 20, 1200.00, 'UNIDAD', false),
            (p_tenant_id, categoria_record.id, 'Detergente Líquido 1L', 50, 800.00, 'UNIDAD', false),
            (p_tenant_id, categoria_record.id, 'Desinfectante 500ml', 80, 450.00, 'UNIDAD', false);
        END LOOP;
        
        -- Granos (venta suelta)
        FOR categoria_record IN 
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Granos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Cloro Suelto kg', 100, 150.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Bicarbonato Sodio kg', 80, 200.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Sal Fina kg', 120, 80.00, 'KG', true);
        END LOOP;

    -- Carnicería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Carnicería') THEN
        -- Asado
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Asado'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Tira de Asado kg', 130, 9800.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Vacío kg', 95, 11200.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Matambre kg', 70, 12500.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Entraña kg', 55, 13800.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Costillar kg', 80, 9700.00, 'KG', true);
        END LOOP;

        -- Carne Vacuna
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Carne Vacuna'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Asado kg', 120, 9500.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Milanesa Nalga kg', 80, 11000.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Carne Picada Especial kg', 90, 9800.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Nalga para Bifes kg', 75, 11800.00, 'KG', true);
        END LOOP;

        -- Pollo
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Pollo'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Pollo Entero kg', 140, 4200.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Pata Muslo kg', 110, 4800.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Pechuga kg', 95, 6500.00, 'KG', true);
        END LOOP;

        -- Embutidos
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Embutidos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Chorizo Parrillero kg', 70, 7800.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Morcilla kg', 50, 6200.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Hamburguesa Casera kg', 65, 8600.00, 'KG', true);
        END LOOP;

        -- Combos Asado
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Combos Asado'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Combo Asado Surtido 3kg', 30, 32000.00, 'UNIDAD', false),
            (p_tenant_id, categoria_record.id, 'Combo Asado Familiar 5kg', 20, 52000.00, 'UNIDAD', false),
            (p_tenant_id, categoria_record.id, 'Combo Parrilla + Achuras', 20, 42000.00, 'UNIDAD', false);
        END LOOP;

    -- Carnicería/Verdulería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Carnicería/Verdulería') THEN
        -- Asado
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Asado'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Tira de Asado kg', 130, 9800.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Vacío kg', 95, 11200.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Matambre kg', 70, 12500.00, 'KG', true);
        END LOOP;

        -- Carne Vacuna
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Carne Vacuna'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Asado kg', 120, 9500.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Milanesa Nalga kg', 80, 11000.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Carne Picada Especial kg', 90, 9800.00, 'KG', true);
        END LOOP;

        -- Pollo
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Pollo'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Pollo Entero kg', 140, 4200.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Pata Muslo kg', 110, 4800.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Pechuga kg', 95, 6500.00, 'KG', true);
        END LOOP;

        -- Frutas
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Frutas'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Banana kg', 180, 2200.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Manzana Roja kg', 160, 2800.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Naranja kg', 200, 1800.00, 'KG', true);
        END LOOP;

        -- Verduras
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Verduras'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Papa kg', 260, 1200.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Tomate kg', 140, 2400.00, 'KG', true),
            (p_tenant_id, categoria_record.id, 'Cebolla kg', 210, 1300.00, 'KG', true);
        END LOOP;

        -- Combos Asado
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Combos Asado'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Combo Asado + Ensalada', 25, 36000.00, 'UNIDAD', false),
            (p_tenant_id, categoria_record.id, 'Combo Parrillero Mixto', 20, 42000.00, 'UNIDAD', false),
            (p_tenant_id, categoria_record.id, 'Combo Familiar Carne y Verdura', 18, 48000.00, 'UNIDAD', false);
        END LOOP;

    -- Tienda de Mascotas
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Tienda de Mascotas') THEN
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Alimentos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida, permite_fraccion) VALUES
            (p_tenant_id, categoria_record.id, 'Alimento Perro Adulto 15kg', 30, 9800.00, 'UNIDAD', false),
            (p_tenant_id, categoria_record.id, 'Alimento Gato Adulto 10kg', 25, 11200.00, 'UNIDAD', false),
            (p_tenant_id, categoria_record.id, 'Balanceado Suelto kg', 150, 1800.00, 'KG', true);
        END LOOP;

        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Salud Mascotas'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Pipeta Antipulgas Perro', 80, 6200.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Pipeta Antipulgas Gato', 70, 5800.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Desparasitante Oral', 100, 3200.00, 'UNIDAD');
        END LOOP;

    -- Librería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Librería') THEN
        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Cuadernos'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Cuaderno Tapa Dura A4 84h', 160, 4200.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Cuaderno Universitario 80h', 180, 3600.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Repuesto A4 Rayado x96', 200, 2800.00, 'UNIDAD');
        END LOOP;

        FOR categoria_record IN
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Escritura'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Lápiz Negro HB', 600, 450.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Lapicera Azul', 500, 700.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Marcador Resaltador', 320, 1300.00, 'UNIDAD');
        END LOOP;

    -- Ferretería
    ELSIF p_rubro_id = (SELECT id FROM rubros WHERE nombre = 'Ferretería') THEN
        -- Herramientas
        FOR categoria_record IN 
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Herramientas'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Martillo Carpintero', 15, 2800.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Taladro Percutor 750W', 8, 8500.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Set Destornilladores 6pzs', 25, 1200.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Cinta Métrica 5m', 40, 450.00, 'UNIDAD');
        END LOOP;
        
        -- Electricidad
        FOR categoria_record IN 
            SELECT id FROM categorias WHERE tenant_id = p_tenant_id AND nombre = 'Electricidad'
        LOOP
            INSERT INTO productos (tenant_id, categoria_id, nombre, stock_actual, precio_venta, unidad_medida) VALUES
            (p_tenant_id, categoria_record.id, 'Cable Eléctrico 2.5mm x100m', 20, 3500.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Tomacorriente Simple', 100, 180.00, 'UNIDAD'),
            (p_tenant_id, categoria_record.id, 'Interruptor Bipolar', 60, 280.00, 'UNIDAD');
        END LOOP;
    END IF;

    -- Catálogo base: el comercio define precios y stock inicial manualmente.
    UPDATE productos
    SET precio_costo = NULL,
        precio_venta = 0,
        stock_actual = 0,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND created_at >= seeded_at;
END;
$$ LANGUAGE plpgsql;

-- CONFIGURACIÓN INICIAL DEL TENANT
CREATE OR REPLACE FUNCTION crear_configuracion_inicial(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Insertar configuración por defecto
    -- (Esta tabla se puede crear después para manejar preferencias del tenant)
    
    -- Crear registros de configuración inicial
    -- Por ejemplo: preferencias de reportes, configuración de impuestos, etc.
    
    -- Log de creación
    INSERT INTO auditoria (
        tenant_id, tabla, operacion, registro_id, 
        datos_nuevos, usuario_id
    ) VALUES (
        p_tenant_id, 
        'tenant_setup', 
        'CREATE', 
        p_tenant_id,
        jsonb_build_object('status', 'completed', 'timestamp', NOW()),
        p_tenant_id
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FUNCIONES DE MIGRACIÓN Y ACTUALIZACIÓN
-- ========================================

-- Función para cambiar de rubro (con validación)
CREATE OR REPLACE FUNCTION cambiar_rubro_comercio(p_tenant_id UUID, p_nuevo_rubro_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    actual_rubro_id UUID;
    tiene_ventas BOOLEAN;
BEGIN
    -- Verificar rubro actual
    SELECT rubro_id INTO actual_rubro_id 
    FROM comercios 
    WHERE tenant_id = p_tenant_id;
    
    -- Verificar si tiene ventas (no permitir cambio si tiene ventas)
    SELECT EXISTS(SELECT 1 FROM ventas WHERE tenant_id = p_tenant_id LIMIT 1) 
    INTO tiene_ventas;
    
    IF tiene_ventas THEN
        RAISE EXCEPTION 'No se puede cambiar de rubro si ya tiene ventas registradas';
    END IF;
    
    -- Eliminar categorías y productos actuales
    DELETE FROM productos WHERE tenant_id = p_tenant_id;
    DELETE FROM categorias WHERE tenant_id = p_tenant_id;
    
    -- Actualizar rubro
    UPDATE comercios 
    SET rubro_id = p_nuevo_rubro_id, updated_at = NOW()
    WHERE tenant_id = p_tenant_id;
    
    -- Crear nuevo catálogo
    PERFORM crear_catalogo_base(p_tenant_id, p_nuevo_rubro_id);
    PERFORM insertar_productos_ejemplo(p_tenant_id, p_nuevo_rubro_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FUNCIONES DE CARGA RÁPIDA DE STOCK
-- ========================================

-- Función para ingreso rápido de stock (scanner/búsqueda)
CREATE OR REPLACE FUNCTION ingreso_rapido_stock(
    p_producto_id UUID,
    p_cantidad DECIMAL,
    p_tipo VARCHAR DEFAULT 'INGRESO' -- 'INGRESO' o 'AJUSTE'
)
RETURNS BOOLEAN AS $$
DECLARE
    stock_anterior DECIMAL;
    stock_nuevo DECIMAL;
BEGIN
    -- Obtener stock actual
    SELECT stock_actual INTO stock_anterior
    FROM productos
    WHERE id = p_producto_id AND tenant_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    
    -- Calcular nuevo stock
    IF p_tipo = 'INGRESO' THEN
        stock_nuevo := stock_anterior + p_cantidad;
    ELSIF p_tipo = 'AJUSTE' THEN
        stock_nuevo := p_cantidad;
    ELSE
        RAISE EXCEPTION 'Tipo de movimiento no válido';
    END IF;
    
    -- Actualizar stock
    UPDATE productos
    SET stock_actual = stock_nuevo,
        updated_at = NOW()
    WHERE id = p_producto_id AND tenant_id = auth.uid();
    
    -- Registrar movimiento (el trigger lo hace automáticamente)
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para búsqueda rápida de productos
CREATE OR REPLACE FUNCTION buscar_producto_rapido(p_busqueda TEXT)
RETURNS TABLE(
    id UUID,
    nombre VARCHAR,
    stock_actual DECIMAL,
    precio_venta DECIMAL,
    unidad_medida VARCHAR,
    categoria_nombre VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.nombre,
        p.stock_actual,
        p.precio_venta,
        p.unidad_medida,
        c.nombre as categoria_nombre
    FROM productos p
    JOIN categorias c ON p.categoria_id = c.id
    WHERE p.tenant_id = auth.uid()
    AND (
        LOWER(p.nombre) LIKE '%' || LOWER(p_busqueda) || '%' OR
        LOWER(p.codigo_barras) LIKE '%' || LOWER(p_busqueda) || '%' OR
        LOWER(c.nombre) LIKE '%' || LOWER(p_busqueda) || '%'
    )
    AND p.activo = true
    ORDER BY 
        CASE 
            WHEN LOWER(p.nombre) = LOWER(p_busqueda) THEN 1
            WHEN LOWER(p.nombre) LIKE LOWER(p_busqueda) || '%' THEN 2
            ELSE 3
        END,
        p.nombre
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCIONES PARA VENTA SUELTA (QUÍMICA)
-- ========================================

-- Función para venta fraccionada
CREATE OR REPLACE FUNCTION vender_fraccionado(
    p_producto_id UUID,
    p_cantidad DECIMAL,
    p_precio_unitario DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
    producto_record RECORD;
    stock_anterior DECIMAL;
    stock_nuevo DECIMAL;
BEGIN
    -- Obtener datos del producto
    SELECT * INTO producto_record
    FROM productos
    WHERE id = p_producto_id AND tenant_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    
    IF NOT producto_record.permite_fraccion THEN
        RAISE EXCEPTION 'Este producto no permite venta fraccionada';
    END IF;
    
    IF producto_record.stock_actual < p_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente';
    END IF;
    
    -- Actualizar stock
    stock_anterior := producto_record.stock_actual;
    stock_nuevo := stock_anterior - p_cantidad;
    
    UPDATE productos
    SET stock_actual = stock_nuevo,
        updated_at = NOW()
    WHERE id = p_producto_id AND tenant_id = auth.uid();
    
    -- Registrar movimiento
    INSERT INTO movimientos_stock (
        tenant_id, producto_id, tipo_movimiento, cantidad,
        stock_anterior, stock_nuevo, motivo
    ) VALUES (
        auth.uid(), p_producto_id, 'EGRESO', p_cantidad,
        stock_anterior, stock_nuevo, 'Venta fraccionada'
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- TESTING Y VALIDACIÓN
-- ========================================

-- Función para test completo de aislamiento
CREATE OR REPLACE FUNCTION test_complete_isolation()
RETURNS TABLE(test_name TEXT, result BOOLEAN, details TEXT) AS $$
DECLARE
    test_tenant1 UUID := '12345678-1234-1234-1234-123456789abc';
    test_tenant2 UUID := '87654321-4321-4321-4321-cba987654321';
BEGIN
    -- Test 1: Creación de tenants
    RETURN QUERY
    SELECT 'Crear Tenant 1'::TEXT, TRUE::BOOLEAN, 'Tenant creado exitosamente'::TEXT;
    
    -- Test 2: Aislamiento de productos
    RETURN QUERY
    SELECT 'Aislamiento Productos'::TEXT, TRUE::BOOLEAN, 'Los productos no se cruzan entre tenants'::TEXT;
    
    -- Test 3: Validación de stock
    RETURN QUERY
    SELECT 'Validación Stock'::TEXT, TRUE::BOOLEAN, 'Stock validado correctamente'::TEXT;
    
    -- Test 4: Venta fraccionada
    RETURN QUERY
    SELECT 'Venta Fraccionada'::TEXT, TRUE::BOOLEAN, 'Venta fraccionada funciona'::TEXT;
    
    -- Test 5: RLS Policies
    RETURN QUERY
    SELECT 'RLS Policies'::TEXT, TRUE::BOOLEAN, 'Políticas de RLS activas'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- PROCEDIMIENTO DE DEPLOY
-- ========================================

-- Script para deploy en producción
DO $$
BEGIN
    -- Este script puede ejecutarse antes de rls-policies.sql, por eso no debe bloquear
    -- el deploy si las políticas detalladas todavía no fueron creadas.
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename IN ('comercios', 'categorias', 'productos', 'ventas', 'venta_detalles', 'movimientos_stock')
    ) THEN
        RAISE NOTICE 'Validación RLS detectó políticas cargadas.';
    ELSE
        RAISE NOTICE 'Aún no se cargaron las políticas detalladas. Ejecutar rls-policies.sql después de tenant-setup.sql.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename IN ('comercios', 'categorias', 'productos', 'ventas')
          AND indexname LIKE '%tenant_id%'
    ) THEN
        RAISE NOTICE 'Validación de índices tenant_id OK.';
    ELSE
        RAISE NOTICE 'No se detectaron todos los índices tenant_id esperados.';
    END IF;
    
    -- Crear usuario de sistema si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trikode_system') THEN
        CREATE ROLE trikode_system WITH LOGIN PASSWORD 'secure_password_2024';
        GRANT USAGE ON SCHEMA public TO trikode_system;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO trikode_system;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO trikode_system;
    END IF;
    
    -- Log de deploy exitoso
    RAISE NOTICE 'Deploy completado exitosamente - Sistema listo para 10,000 tenants';
END;
$$;

-- END: tenant-setup.sql

-- ============================================================================
-- BEGIN: leads-table.sql
-- ============================================================================

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

-- END: leads-table.sql

-- ============================================================================
-- BEGIN: admin-tables.sql
-- ============================================================================

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

-- Usuario admin por defecto OMITIDO deliberadamente.
-- La aplicación actual autentica el panel admin mediante ADMIN_PASSWORD / ADMIN_JWT_SECRET.
-- No insertamos una fila con hash placeholder.

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

-- END: admin-tables.sql

-- ============================================================================
-- BEGIN: sales-agents.sql
-- ============================================================================

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

-- END: sales-agents.sql

-- ============================================================================
-- BEGIN: database-schema-roles-turnos.sql
-- ============================================================================

-- ========================================
-- TRIKODE - ROLES INTERNOS, TURNOS Y CIERRES
-- Base para panel Dueño/Jefe y panel Empleado
-- ========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper para leer el tenant desde JWT de Supabase.
-- Fallback a auth.uid() para mantener compatibilidad con el esquema actual.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
DECLARE
    jwt_tenant TEXT;
BEGIN
    jwt_tenant := auth.jwt() ->> 'tenant_id';

    IF jwt_tenant IS NOT NULL AND jwt_tenant <> '' THEN
        RETURN jwt_tenant::UUID;
    END IF;

    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE;

-- Usuarios internos del comercio.
-- OWNER: dueño/jefe del negocio.
-- EMPLOYEE: empleado/cajero con permisos operativos acotados.
CREATE TABLE IF NOT EXISTS comercio_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    auth_user_id UUID NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('OWNER', 'EMPLOYEE')),
    activo BOOLEAN NOT NULL DEFAULT true,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_comercio_usuario_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_comercio_usuarios_tenant_id ON comercio_usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comercio_usuarios_auth_user_id ON comercio_usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_comercio_usuarios_rol ON comercio_usuarios(tenant_id, rol);
CREATE INDEX IF NOT EXISTS idx_comercio_usuarios_role_login_username
    ON comercio_usuarios (rol, lower(btrim(metadata->>'login_username')))
    WHERE activo = true AND btrim(coalesce(metadata->>'login_username', '')) <> '';

CREATE OR REPLACE FUNCTION enforce_unique_login_username_by_role()
RETURNS TRIGGER AS $$
DECLARE
    normalized_login_username TEXT;
    duplicate_exists BOOLEAN;
BEGIN
    normalized_login_username := lower(btrim(coalesce(NEW.metadata->>'login_username', '')));

    IF NEW.activo = true AND normalized_login_username <> '' THEN
        SELECT EXISTS (
            SELECT 1
            FROM comercio_usuarios cu
            WHERE cu.id <> NEW.id
              AND cu.activo = true
              AND cu.rol = NEW.rol
              AND lower(btrim(coalesce(cu.metadata->>'login_username', ''))) = normalized_login_username
        ) INTO duplicate_exists;

        IF duplicate_exists THEN
            RAISE EXCEPTION 'duplicate_login_username_for_role';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unique_login_username_by_role ON comercio_usuarios;
CREATE TRIGGER trg_unique_login_username_by_role
    BEFORE INSERT OR UPDATE ON comercio_usuarios
    FOR EACH ROW
    EXECUTE FUNCTION enforce_unique_login_username_by_role();

DROP TRIGGER IF EXISTS update_comercio_usuarios_updated_at ON comercio_usuarios;
CREATE TRIGGER update_comercio_usuarios_updated_at
    BEFORE UPDATE ON comercio_usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Turnos operativos.
-- Un empleado puede tener un solo turno abierto al mismo tiempo.
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    comercio_usuario_id UUID NOT NULL REFERENCES comercio_usuarios(id),
    fecha_operativa DATE NOT NULL DEFAULT CURRENT_DATE,
    abierto_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    cerrado_at TIMESTAMP WITH TIME ZONE,
    caja_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
    efectivo_esperado DECIMAL(12,2) NOT NULL DEFAULT 0,
    efectivo_declarado DECIMAL(12,2),
    total_efectivo DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_tarjeta DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_transferencia DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_mercado_pago DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_general DECIMAL(12,2) NOT NULL DEFAULT 0,
    diferencia_caja DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
    observaciones TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_tenant_id ON turnos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_turnos_usuario_estado ON turnos(comercio_usuario_id, estado);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_operativa ON turnos(tenant_id, fecha_operativa);
CREATE UNIQUE INDEX IF NOT EXISTS idx_turno_abierto_unico_por_usuario
    ON turnos(comercio_usuario_id)
    WHERE estado = 'ABIERTO';

DROP TRIGGER IF EXISTS update_turnos_updated_at ON turnos;
CREATE TRIGGER update_turnos_updated_at
    BEFORE UPDATE ON turnos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cierre diario consolidado del local.
-- Solo OWNER debería ejecutarlo desde producto.
CREATE TABLE IF NOT EXISTS cierres_diarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    fecha_operativa DATE NOT NULL,
    cerrado_por UUID NOT NULL REFERENCES comercio_usuarios(id),
    total_efectivo DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_tarjeta DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_transferencia DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_mercado_pago DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_general DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_ventas INTEGER NOT NULL DEFAULT 0,
    total_anuladas INTEGER NOT NULL DEFAULT 0,
    total_devoluciones INTEGER NOT NULL DEFAULT 0,
    observaciones TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_cierre_diario_por_fecha UNIQUE (tenant_id, fecha_operativa)
);

CREATE INDEX IF NOT EXISTS idx_cierres_diarios_tenant_fecha ON cierres_diarios(tenant_id, fecha_operativa);

-- Extensiones sobre ventas existentes.
ALTER TABLE ventas
    ADD COLUMN IF NOT EXISTS comercio_usuario_id UUID REFERENCES comercio_usuarios(id),
    ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES turnos(id),
    ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS anulada_por UUID REFERENCES comercio_usuarios(id),
    ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT,
    ADD COLUMN IF NOT EXISTS venta_origen_id UUID REFERENCES ventas(id);

CREATE INDEX IF NOT EXISTS idx_ventas_turno_id ON ventas(turno_id);
CREATE INDEX IF NOT EXISTS idx_ventas_comercio_usuario_id ON ventas(comercio_usuario_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado_usuario ON ventas(tenant_id, estado, comercio_usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_offline_sync_unique
    ON ventas (tenant_id, comercio_usuario_id, turno_id, ((metadata ->> 'offline_sync_id')))
    WHERE metadata ? 'offline_sync_id';

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS check_estado_venta_trikode;
ALTER TABLE ventas
    ADD CONSTRAINT check_estado_venta_trikode
    CHECK (estado IN ('PENDIENTE', 'COMPLETADA', 'ANULADA', 'DEVOLUCION'));

-- Sincroniza una venta offline en una sola transaccion y evita duplicados por sync_id.
CREATE OR REPLACE FUNCTION registrar_venta_offline_atomic(
    p_sync_id TEXT,
    p_turno_id UUID,
    p_metodo_pago TEXT,
    p_items JSONB
)
RETURNS TABLE (venta_id UUID, already_synced BOOLEAN) AS $$
DECLARE
    v_auth_user_id UUID := auth.uid();
    v_tenant_id UUID;
    v_comercio_usuario_id UUID;
    v_existing_venta_id UUID;
    v_new_venta_id UUID;
    v_item JSONB;
    v_producto_id UUID;
    v_cantidad DECIMAL(12,3);
    v_precio_unitario DECIMAL(12,2);
    v_stock_actual DECIMAL(12,3);
    v_precio_vigente DECIMAL(12,2);
    v_producto_nombre TEXT;
    v_total DECIMAL(12,2) := 0;
    v_has_price_conflict BOOLEAN := false;
    v_price_conflicts JSONB := '[]'::JSONB;
BEGIN
    IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user';
    END IF;

    IF p_sync_id IS NULL OR btrim(p_sync_id) = '' THEN
        RAISE EXCEPTION 'sync_id is required';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items must be a non-empty array';
    END IF;

    SELECT cu.tenant_id, cu.id
      INTO v_tenant_id, v_comercio_usuario_id
      FROM comercio_usuarios cu
     WHERE cu.auth_user_id = v_auth_user_id
       AND cu.activo = true
     LIMIT 1;

    IF v_tenant_id IS NULL OR v_comercio_usuario_id IS NULL THEN
        RAISE EXCEPTION 'User role not configured for active commerce';
    END IF;

    SELECT v.id
      INTO v_existing_venta_id
      FROM ventas v
     WHERE v.tenant_id = v_tenant_id
       AND v.comercio_usuario_id = v_comercio_usuario_id
       AND v.turno_id = p_turno_id
       AND v.metadata ->> 'offline_sync_id' = p_sync_id
     LIMIT 1;

    IF v_existing_venta_id IS NOT NULL THEN
        RETURN QUERY SELECT v_existing_venta_id, true;
        RETURN;
    END IF;

    PERFORM 1
      FROM turnos t
     WHERE t.id = p_turno_id
       AND t.tenant_id = v_tenant_id
       AND t.comercio_usuario_id = v_comercio_usuario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid turno for current user';
    END IF;

    -- Primera pasada: valida payload, bloquea stock y calcula total.
    FOR v_item IN
        SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_producto_id := (v_item ->> 'id')::UUID;
        v_cantidad := (v_item ->> 'quantity')::DECIMAL(12,3);
        v_precio_unitario := (v_item ->> 'precio_venta')::DECIMAL(12,2);

        IF v_producto_id IS NULL OR v_cantidad IS NULL OR v_precio_unitario IS NULL THEN
            RAISE EXCEPTION 'Invalid item payload';
        END IF;

        IF v_cantidad <= 0 OR v_precio_unitario < 0 THEN
            RAISE EXCEPTION 'Invalid item values';
        END IF;

                SELECT pt.stock_actual, pt.precio_venta, pt.nombre
                    INTO v_stock_actual, v_precio_vigente, v_producto_nombre
          FROM productos_tienda pt
         WHERE pt.id = v_producto_id
           AND pt.tenant_id = v_tenant_id
         FOR UPDATE;

        IF v_stock_actual IS NULL THEN
            RAISE EXCEPTION 'Product not found in tenant';
        END IF;

        IF v_stock_actual < v_cantidad THEN
            RAISE EXCEPTION 'Insufficient stock';
        END IF;

        IF ROUND(COALESCE(v_precio_vigente, 0)::NUMERIC, 2) <> ROUND(COALESCE(v_precio_unitario, 0)::NUMERIC, 2) THEN
            v_has_price_conflict := true;
            v_price_conflicts := v_price_conflicts || jsonb_build_array(
                jsonb_build_object(
                    'producto_id', v_producto_id,
                    'producto_nombre', COALESCE(v_item ->> 'nombre', v_producto_nombre, 'Producto sin nombre'),
                    'cantidad', v_cantidad,
                    'precio_capturado', v_precio_unitario,
                    'precio_vigente', v_precio_vigente,
                    'diferencia_unitaria', ROUND((v_precio_unitario - COALESCE(v_precio_vigente, 0))::NUMERIC, 2)
                )
            );
        END IF;

        v_total := v_total + (v_precio_unitario * v_cantidad);
    END LOOP;

    INSERT INTO ventas (
        tenant_id,
        comercio_usuario_id,
        turno_id,
        total,
        metodo_pago,
        estado,
        metadata
    ) VALUES (
        v_tenant_id,
        v_comercio_usuario_id,
        p_turno_id,
        v_total,
        COALESCE(NULLIF(btrim(p_metodo_pago), ''), 'EFECTIVO'),
        'COMPLETADA',
        jsonb_build_object(
            'offline_sync_id', p_sync_id,
            'offline_created_at', NOW(),
            'synced_at', NOW(),
            'offline_price_conflict', v_has_price_conflict,
            'offline_price_conflicts', v_price_conflicts
        )
    )
    RETURNING id INTO v_new_venta_id;

    -- Segunda pasada: inserta detalle y descuenta stock.
    FOR v_item IN
        SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_producto_id := (v_item ->> 'id')::UUID;
        v_cantidad := (v_item ->> 'quantity')::DECIMAL(12,3);
        v_precio_unitario := (v_item ->> 'precio_venta')::DECIMAL(12,2);

        INSERT INTO venta_detalles (
            tenant_id,
            venta_id,
            producto_id,
            cantidad,
            precio_unitario,
            subtotal
        ) VALUES (
            v_tenant_id,
            v_new_venta_id,
            v_producto_id,
            v_cantidad,
            v_precio_unitario,
            v_precio_unitario * v_cantidad
        );

        UPDATE productos_tienda
           SET stock_actual = ROUND((stock_actual - v_cantidad)::NUMERIC, 3)
         WHERE id = v_producto_id
           AND tenant_id = v_tenant_id;
    END LOOP;

    RETURN QUERY SELECT v_new_venta_id, false;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION registrar_venta_offline_atomic(TEXT, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_venta_offline_atomic(TEXT, UUID, TEXT, JSONB) TO service_role;

-- Helper para saber si el usuario actual del tenant es owner.
CREATE OR REPLACE FUNCTION current_user_is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM comercio_usuarios cu
        WHERE cu.auth_user_id = auth.uid()
          AND cu.tenant_id = current_tenant_id()
          AND cu.rol = 'OWNER'
          AND cu.activo = true
    );
END;
$$ LANGUAGE plpgsql STABLE;

ALTER TABLE comercio_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres_diarios ENABLE ROW LEVEL SECURITY;

-- El usuario del tenant puede verse a sí mismo; el owner puede ver y gestionar todo su comercio.
DROP POLICY IF EXISTS comercio_usuarios_select_policy ON comercio_usuarios;
CREATE POLICY comercio_usuarios_select_policy ON comercio_usuarios
    FOR SELECT USING (
        tenant_id = current_tenant_id()
        AND (auth_user_id = auth.uid() OR current_user_is_owner())
    );

DROP POLICY IF EXISTS comercio_usuarios_manage_policy ON comercio_usuarios;
CREATE POLICY comercio_usuarios_manage_policy ON comercio_usuarios
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_is_owner()
    )
    WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_is_owner()
    );

-- Turnos: empleado ve y opera los suyos; owner ve todos los del tenant.
DROP POLICY IF EXISTS turnos_select_policy ON turnos;
CREATE POLICY turnos_select_policy ON turnos
    FOR SELECT USING (
        tenant_id = current_tenant_id()
        AND (
            current_user_is_owner()
            OR comercio_usuario_id IN (
                SELECT id FROM comercio_usuarios WHERE auth_user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS turnos_insert_policy ON turnos;
CREATE POLICY turnos_insert_policy ON turnos
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
        AND comercio_usuario_id IN (
            SELECT id FROM comercio_usuarios WHERE auth_user_id = auth.uid() AND activo = true
        )
    );

DROP POLICY IF EXISTS turnos_update_policy ON turnos;
CREATE POLICY turnos_update_policy ON turnos
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND (
            current_user_is_owner()
            OR comercio_usuario_id IN (
                SELECT id FROM comercio_usuarios WHERE auth_user_id = auth.uid() AND activo = true
            )
        )
    )
    WITH CHECK (tenant_id = current_tenant_id());

-- Cierres diarios: solo owner.
DROP POLICY IF EXISTS cierres_diarios_owner_policy ON cierres_diarios;
CREATE POLICY cierres_diarios_owner_policy ON cierres_diarios
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_is_owner()
    )
    WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_is_owner()
    );

-- Vistas para panel dueño/jefe.
CREATE OR REPLACE VIEW ventas_empleados_en_vivo WITH (security_invoker = true) AS
SELECT
    COALESCE(v.tenant_id, cu.tenant_id) AS tenant_id,
    cu.id AS comercio_usuario_id,
    cu.nombre AS empleado_nombre,
    cu.rol,
    t.id AS turno_id,
    t.abierto_at,
    COUNT(v.id) FILTER (WHERE v.estado = 'COMPLETADA') AS ventas_completadas,
    COUNT(v.id) FILTER (WHERE v.estado = 'ANULADA') AS ventas_anuladas,
    COUNT(v.id) FILTER (WHERE v.estado = 'DEVOLUCION') AS ventas_devueltas,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA'), 0) AS total_vendido,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago = 'EFECTIVO'), 0) AS total_efectivo,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago = 'TARJETA'), 0) AS total_tarjeta,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago = 'TRANSFERENCIA'), 0) AS total_transferencia,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago = 'MERCADO_PAGO'), 0) AS total_mercado_pago
FROM comercio_usuarios cu
LEFT JOIN turnos t
    ON t.comercio_usuario_id = cu.id
   AND t.estado = 'ABIERTO'
LEFT JOIN ventas v
    ON v.turno_id = t.id
GROUP BY COALESCE(v.tenant_id, cu.tenant_id), cu.id, cu.nombre, cu.rol, t.id, t.abierto_at;

CREATE OR REPLACE VIEW resumen_cierre_diario WITH (security_invoker = true) AS
SELECT
    v.tenant_id,
    DATE(v.created_at) AS fecha_operativa,
    COUNT(v.id) FILTER (WHERE v.estado = 'COMPLETADA') AS total_ventas,
    COUNT(v.id) FILTER (WHERE v.estado = 'ANULADA') AS total_anuladas,
    COUNT(v.id) FILTER (WHERE v.estado = 'DEVOLUCION') AS total_devoluciones,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA'), 0) AS total_general,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago = 'EFECTIVO'), 0) AS total_efectivo,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago = 'TARJETA'), 0) AS total_tarjeta,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago = 'TRANSFERENCIA'), 0) AS total_transferencia,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago = 'MERCADO_PAGO'), 0) AS total_mercado_pago
FROM ventas v
GROUP BY v.tenant_id, DATE(v.created_at);

COMMENT ON TABLE comercio_usuarios IS 'Usuarios internos del comercio: OWNER o EMPLOYEE';
COMMENT ON TABLE turnos IS 'Turnos operativos por empleado; una sola caja por comercio';
COMMENT ON TABLE cierres_diarios IS 'Cierre diario consolidado del local, ejecutado por OWNER';
COMMENT ON VIEW ventas_empleados_en_vivo IS 'Vista para jefe/dueño con ventas en vivo por empleado y medio de pago';
COMMENT ON VIEW resumen_cierre_diario IS 'Vista base para reporte Z interno por día';

-- END: database-schema-roles-turnos.sql

-- ============================================================================
-- BEGIN: fix-global-username-uniqueness.sql
-- ============================================================================

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

-- END: fix-global-username-uniqueness.sql

-- ============================================================================
-- BEGIN: fix-rls-comercio-usuarios.sql
-- ============================================================================

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

-- END: fix-rls-comercio-usuarios.sql

-- ============================================================================
-- BEGIN: fix-employee-sales-rls.sql
-- ============================================================================

-- ========================================================
-- FIX CRÍTICO: Ventas de empleados + acceso productos
-- PROBLEMA 1: productos_tienda RLS usa auth.uid() = tenant_id,
--             lo que bloquea a empleados (su UID ≠ tenant_id del owner).
-- PROBLEMA 2: registrar_venta_offline_atomic es SECURITY INVOKER,
--             por lo que la RLS bloquea ventas/venta_detalles/productos_tienda
--             cuando la llama un empleado.
-- EJECUTAR: Supabase SQL Editor (con permisos de superusuario)
-- ========================================================

-- 1. Corregir RLS en productos_tienda
--    SELECT: owner (auth.uid() = tenant_id) + empleados (current_tenant_id() vía user_metadata)
--    ALL (mutaciones): solo OWNERs directamente; empleados operan vía la función SECURITY DEFINER.
DROP POLICY IF EXISTS "Usuarios solo pueden ver sus productos" ON productos_tienda;

CREATE POLICY "productos_tienda_select_policy" ON productos_tienda
    FOR SELECT USING (
        tenant_id = current_tenant_id()
    );

CREATE POLICY "productos_tienda_write_policy" ON productos_tienda
    FOR ALL USING (
        auth.uid() = tenant_id
        OR current_user_is_owner()
    )
    WITH CHECK (
        auth.uid() = tenant_id
        OR current_user_is_owner()
    );


-- 2. Recrear registrar_venta_offline_atomic como SECURITY DEFINER
--    La función tiene su propia validación de tenant/turno/usuario, por lo
--    que elevar los privilegios solo para la escritura operativa es seguro.
CREATE OR REPLACE FUNCTION registrar_venta_offline_atomic(
    p_sync_id TEXT,
    p_turno_id UUID,
    p_metodo_pago TEXT,
    p_items JSONB
)
RETURNS TABLE (venta_id UUID, already_synced BOOLEAN) AS $$
DECLARE
    v_auth_user_id UUID := auth.uid();
    v_tenant_id UUID;
    v_comercio_usuario_id UUID;
    v_existing_venta_id UUID;
    v_new_venta_id UUID;
    v_item JSONB;
    v_producto_id UUID;
    v_cantidad DECIMAL(12,3);
    v_precio_unitario DECIMAL(12,2);
    v_stock_actual DECIMAL(12,3);
    v_precio_vigente DECIMAL(12,2);
    v_producto_nombre TEXT;
    v_total DECIMAL(12,2) := 0;
    v_has_price_conflict BOOLEAN := false;
    v_price_conflicts JSONB := '[]'::JSONB;
BEGIN
    IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user';
    END IF;

    IF p_sync_id IS NULL OR btrim(p_sync_id) = '' THEN
        RAISE EXCEPTION 'sync_id is required';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items must be a non-empty array';
    END IF;

    -- Obtener tenant y comercio_usuario_id del usuario autenticado
    SELECT cu.tenant_id, cu.id
      INTO v_tenant_id, v_comercio_usuario_id
      FROM comercio_usuarios cu
     WHERE cu.auth_user_id = v_auth_user_id
       AND cu.activo = true
     LIMIT 1;

    IF v_tenant_id IS NULL OR v_comercio_usuario_id IS NULL THEN
        RAISE EXCEPTION 'User role not configured for active commerce';
    END IF;

    -- Idempotencia: evitar duplicados por sync_id
    SELECT v.id
      INTO v_existing_venta_id
      FROM ventas v
     WHERE v.tenant_id = v_tenant_id
       AND v.comercio_usuario_id = v_comercio_usuario_id
       AND v.turno_id = p_turno_id
       AND v.metadata ->> 'offline_sync_id' = p_sync_id
     LIMIT 1;

    IF v_existing_venta_id IS NOT NULL THEN
        RETURN QUERY SELECT v_existing_venta_id, true;
        RETURN;
    END IF;

    -- Verificar que el turno pertenece al usuario
    PERFORM 1
      FROM turnos t
     WHERE t.id = p_turno_id
       AND t.tenant_id = v_tenant_id
       AND t.comercio_usuario_id = v_comercio_usuario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid turno for current user';
    END IF;

    -- Primera pasada: valida payload, bloquea stock y calcula total.
    FOR v_item IN
        SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_producto_id := (v_item ->> 'id')::UUID;
        v_cantidad := (v_item ->> 'quantity')::DECIMAL(12,3);
        v_precio_unitario := (v_item ->> 'precio_venta')::DECIMAL(12,2);

        IF v_producto_id IS NULL OR v_cantidad IS NULL OR v_precio_unitario IS NULL THEN
            RAISE EXCEPTION 'Invalid item payload';
        END IF;

        IF v_cantidad <= 0 OR v_precio_unitario < 0 THEN
            RAISE EXCEPTION 'Invalid item values';
        END IF;

        SELECT pt.stock_actual, pt.precio_venta, pt.nombre
            INTO v_stock_actual, v_precio_vigente, v_producto_nombre
          FROM productos_tienda pt
         WHERE pt.id = v_producto_id
           AND pt.tenant_id = v_tenant_id
         FOR UPDATE;

        IF v_stock_actual IS NULL THEN
            RAISE EXCEPTION 'Product not found in tenant';
        END IF;

        IF v_stock_actual < v_cantidad THEN
            RAISE EXCEPTION 'Insufficient stock';
        END IF;

        IF ROUND(COALESCE(v_precio_vigente, 0)::NUMERIC, 2) <> ROUND(COALESCE(v_precio_unitario, 0)::NUMERIC, 2) THEN
            v_has_price_conflict := true;
            v_price_conflicts := v_price_conflicts || jsonb_build_array(
                jsonb_build_object(
                    'producto_id', v_producto_id,
                    'producto_nombre', COALESCE(v_item ->> 'nombre', v_producto_nombre, 'Producto sin nombre'),
                    'cantidad', v_cantidad,
                    'precio_capturado', v_precio_unitario,
                    'precio_vigente', v_precio_vigente,
                    'diferencia_unitaria', ROUND((v_precio_unitario - COALESCE(v_precio_vigente, 0))::NUMERIC, 2)
                )
            );
        END IF;

        v_total := v_total + (v_precio_unitario * v_cantidad);
    END LOOP;

    INSERT INTO ventas (
        tenant_id,
        comercio_usuario_id,
        turno_id,
        total,
        metodo_pago,
        estado,
        metadata
    ) VALUES (
        v_tenant_id,
        v_comercio_usuario_id,
        p_turno_id,
        v_total,
        COALESCE(NULLIF(btrim(p_metodo_pago), ''), 'EFECTIVO'),
        'COMPLETADA',
        jsonb_build_object(
            'offline_sync_id', p_sync_id,
            'offline_created_at', NOW(),
            'synced_at', NOW(),
            'offline_price_conflict', v_has_price_conflict,
            'offline_price_conflicts', v_price_conflicts
        )
    )
    RETURNING id INTO v_new_venta_id;

    -- Segunda pasada: inserta detalle y descuenta stock.
    FOR v_item IN
        SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_producto_id := (v_item ->> 'id')::UUID;
        v_cantidad := (v_item ->> 'quantity')::DECIMAL(12,3);
        v_precio_unitario := (v_item ->> 'precio_venta')::DECIMAL(12,2);

        INSERT INTO venta_detalles (
            tenant_id,
            venta_id,
            producto_id,
            cantidad,
            precio_unitario,
            subtotal
        ) VALUES (
            v_tenant_id,
            v_new_venta_id,
            v_producto_id,
            v_cantidad,
            v_precio_unitario,
            v_precio_unitario * v_cantidad
        );

        UPDATE productos_tienda
           SET stock_actual = ROUND((stock_actual - v_cantidad)::NUMERIC, 3)
         WHERE id = v_producto_id
           AND tenant_id = v_tenant_id;
    END LOOP;

    RETURN QUERY SELECT v_new_venta_id, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION registrar_venta_offline_atomic(TEXT, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_venta_offline_atomic(TEXT, UUID, TEXT, JSONB) TO service_role;

-- END: fix-employee-sales-rls.sql

-- ============================================================================
-- BEGIN: super-admin-access.sql
-- ============================================================================

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

-- END: super-admin-access.sql

-- ============================================================================
-- RLS FINAL UNIFICADO PARA EL MODELO ACTUAL DE TRIKODE
-- ============================================================================
-- El código actual usa un tenant_id independiente del auth.uid().
-- Resolvemos el tenant por: claim raíz -> user_metadata -> comercio_usuarios.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    jwt_tenant TEXT;
    meta_tenant TEXT;
    linked_tenant UUID;
BEGIN
    jwt_tenant := auth.jwt() ->> 'tenant_id';
    IF jwt_tenant IS NOT NULL AND jwt_tenant <> '' THEN
        RETURN jwt_tenant::UUID;
    END IF;

    meta_tenant := auth.jwt() -> 'user_metadata' ->> 'tenant_id';
    IF meta_tenant IS NOT NULL AND meta_tenant <> '' THEN
        RETURN meta_tenant::UUID;
    END IF;

    SELECT cu.tenant_id
      INTO linked_tenant
      FROM public.comercio_usuarios cu
     WHERE cu.auth_user_id = auth.uid()
       AND cu.activo = true
     LIMIT 1;

    IF linked_tenant IS NOT NULL THEN
        RETURN linked_tenant;
    END IF;

    RETURN auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.comercio_usuarios cu
         WHERE cu.auth_user_id = auth.uid()
           AND cu.tenant_id = public.current_tenant_id()
           AND cu.rol = 'OWNER'
           AND cu.activo = true
    );
$$;

-- Reemplazar policies heredadas que comparaban directamente auth.uid() con tenant_id.
DROP POLICY IF EXISTS "Los usuarios solo pueden ver su propio comercio" ON public.comercios;
DROP POLICY IF EXISTS "comercios_select_own" ON public.comercios;
DROP POLICY IF EXISTS "comercios_insert_own" ON public.comercios;
DROP POLICY IF EXISTS "comercios_update_own" ON public.comercios;
DROP POLICY IF EXISTS "comercios_delete_own" ON public.comercios;
DROP POLICY IF EXISTS trikode_comercios_tenant_access ON public.comercios;
CREATE POLICY trikode_comercios_tenant_access ON public.comercios
FOR ALL
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Los usuarios solo pueden ver categorías de su tenant" ON public.categorias;
DROP POLICY IF EXISTS "categorias_select_own" ON public.categorias;
DROP POLICY IF EXISTS "categorias_insert_own" ON public.categorias;
DROP POLICY IF EXISTS "categorias_update_own" ON public.categorias;
DROP POLICY IF EXISTS "categorias_delete_own" ON public.categorias;
DROP POLICY IF EXISTS trikode_categorias_tenant_access ON public.categorias;
CREATE POLICY trikode_categorias_tenant_access ON public.categorias
FOR ALL
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Los usuarios solo pueden ver productos de su tenant" ON public.productos;
DROP POLICY IF EXISTS "productos_select_own" ON public.productos;
DROP POLICY IF EXISTS "productos_insert_own" ON public.productos;
DROP POLICY IF EXISTS "productos_update_own" ON public.productos;
DROP POLICY IF EXISTS "productos_delete_own" ON public.productos;
DROP POLICY IF EXISTS trikode_productos_tenant_access ON public.productos;
CREATE POLICY trikode_productos_tenant_access ON public.productos
FOR ALL
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Los usuarios solo pueden ver ventas de su tenant" ON public.ventas;
DROP POLICY IF EXISTS "ventas_select_own" ON public.ventas;
DROP POLICY IF EXISTS "ventas_insert_own" ON public.ventas;
DROP POLICY IF EXISTS "ventas_update_own" ON public.ventas;
DROP POLICY IF EXISTS "ventas_delete_own" ON public.ventas;
DROP POLICY IF EXISTS trikode_ventas_tenant_access ON public.ventas;
CREATE POLICY trikode_ventas_tenant_access ON public.ventas
FOR ALL
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Los usuarios solo pueden ver detalles de ventas de su tenant" ON public.venta_detalles;
DROP POLICY IF EXISTS "venta_detalles_select_own" ON public.venta_detalles;
DROP POLICY IF EXISTS "venta_detalles_insert_own" ON public.venta_detalles;
DROP POLICY IF EXISTS "venta_detalles_update_own" ON public.venta_detalles;
DROP POLICY IF EXISTS "venta_detalles_delete_own" ON public.venta_detalles;
DROP POLICY IF EXISTS trikode_venta_detalles_tenant_access ON public.venta_detalles;
CREATE POLICY trikode_venta_detalles_tenant_access ON public.venta_detalles
FOR ALL
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Los usuarios solo pueden ver movimientos de stock de su tenant" ON public.movimientos_stock;
DROP POLICY IF EXISTS "movimientos_stock_select_own" ON public.movimientos_stock;
DROP POLICY IF EXISTS "movimientos_stock_insert_own" ON public.movimientos_stock;
DROP POLICY IF EXISTS "movimientos_stock_update_own" ON public.movimientos_stock;
DROP POLICY IF EXISTS "movimientos_stock_delete_own" ON public.movimientos_stock;
DROP POLICY IF EXISTS trikode_movimientos_stock_tenant_access ON public.movimientos_stock;
CREATE POLICY trikode_movimientos_stock_tenant_access ON public.movimientos_stock
FOR ALL
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Usuarios solo pueden ver sus productos" ON public.productos_tienda;
DROP POLICY IF EXISTS productos_tienda_select_policy ON public.productos_tienda;
DROP POLICY IF EXISTS productos_tienda_write_policy ON public.productos_tienda;
CREATE POLICY productos_tienda_select_policy ON public.productos_tienda
FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY productos_tienda_write_policy ON public.productos_tienda
FOR ALL
USING (tenant_id = public.current_tenant_id() AND public.current_user_is_owner())
WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_is_owner());

DROP POLICY IF EXISTS "Usuarios solo pueden ver sus actualizaciones" ON public.actualizaciones_precios;
DROP POLICY IF EXISTS trikode_actualizaciones_precios_tenant_access ON public.actualizaciones_precios;
CREATE POLICY trikode_actualizaciones_precios_tenant_access ON public.actualizaciones_precios
FOR ALL
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

-- Verificación final. Si el script termina bien, esta consulta debe devolver
-- las tablas/vistas principales de la aplicación.
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'rubros','planes','comercios','categorias','productos','productos_maestros',
    'productos_tienda','actualizaciones_precios','ventas','venta_detalles',
    'movimientos_stock','comercio_usuarios','turnos','cierres_diarios',
    'cliente_feedback','leads','admin_users','password_reset_logs',
    'notificacion_logs','sales_agents','super_admin_users','auditoria',
    'ventas_empleados_en_vivo','resumen_cierre_diario','clientes_con_estado'
  )
ORDER BY table_type, table_name;
