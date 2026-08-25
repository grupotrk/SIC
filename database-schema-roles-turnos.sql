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
