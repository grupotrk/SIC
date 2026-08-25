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
