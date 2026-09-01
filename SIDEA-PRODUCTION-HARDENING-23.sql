-- ================================================================
-- SIDEA SIC · HARDENING DE PRODUCCIÓN · PATCH 23
-- Ejecutar UNA VEZ en Supabase SQL Editor.
-- No borra datos. Refuerza aislamiento, integridad y ventas atómicas.
-- ================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comercios_tenant_id_unique ON public.comercios(tenant_id);

CREATE OR REPLACE FUNCTION public.trikode_tenant_access_mode(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_comercio RECORD;
    v_overdue_days INTEGER;
BEGIN
    SELECT activo, suscripcion_vence_at, solo_descarga_hasta, depurado_at
      INTO v_comercio
      FROM public.comercios
     WHERE tenant_id = p_tenant_id;

    IF NOT FOUND OR v_comercio.activo IS DISTINCT FROM true OR v_comercio.depurado_at IS NOT NULL THEN
        RETURN 'BLOCKED';
    END IF;

    IF v_comercio.suscripcion_vence_at IS NULL THEN RETURN 'FULL'; END IF;

    v_overdue_days := CURRENT_DATE - v_comercio.suscripcion_vence_at;
    IF v_overdue_days <= 7 THEN RETURN 'FULL'; END IF;

    IF v_comercio.solo_descarga_hasta IS NOT NULL AND CURRENT_DATE <= v_comercio.solo_descarga_hasta THEN
        RETURN 'DOWNLOAD_ONLY';
    END IF;

    RETURN 'BLOCKED';
END;
$$;

CREATE OR REPLACE FUNCTION public.sidea_enforce_tenant_relations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_TABLE_NAME = 'turnos' THEN
        IF NOT EXISTS (SELECT 1 FROM public.comercio_usuarios cu WHERE cu.id = NEW.comercio_usuario_id AND cu.tenant_id = NEW.tenant_id) THEN
            RAISE EXCEPTION 'tenant_relation_violation:turnos_usuario';
        END IF;
    ELSIF TG_TABLE_NAME = 'ventas' THEN
        IF NEW.comercio_usuario_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.comercio_usuarios cu WHERE cu.id = NEW.comercio_usuario_id AND cu.tenant_id = NEW.tenant_id
        ) THEN RAISE EXCEPTION 'tenant_relation_violation:ventas_usuario'; END IF;
        IF NEW.turno_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.turnos t WHERE t.id = NEW.turno_id AND t.tenant_id = NEW.tenant_id
        ) THEN RAISE EXCEPTION 'tenant_relation_violation:ventas_turno'; END IF;
    ELSIF TG_TABLE_NAME = 'venta_detalles' THEN
        IF NOT EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = NEW.venta_id AND v.tenant_id = NEW.tenant_id) THEN
            RAISE EXCEPTION 'tenant_relation_violation:detalle_venta';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.productos_tienda p WHERE p.id = NEW.producto_id AND p.tenant_id = NEW.tenant_id) THEN
            RAISE EXCEPTION 'tenant_relation_violation:detalle_producto';
        END IF;
    ELSIF TG_TABLE_NAME = 'cierres_diarios' THEN
        IF NOT EXISTS (SELECT 1 FROM public.comercio_usuarios cu WHERE cu.id = NEW.cerrado_por AND cu.tenant_id = NEW.tenant_id) THEN
            RAISE EXCEPTION 'tenant_relation_violation:cierre_usuario';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sidea_tenant_turnos ON public.turnos;
CREATE TRIGGER trg_sidea_tenant_turnos BEFORE INSERT OR UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.sidea_enforce_tenant_relations();
DROP TRIGGER IF EXISTS trg_sidea_tenant_ventas ON public.ventas;
CREATE TRIGGER trg_sidea_tenant_ventas BEFORE INSERT OR UPDATE ON public.ventas FOR EACH ROW EXECUTE FUNCTION public.sidea_enforce_tenant_relations();
DROP TRIGGER IF EXISTS trg_sidea_tenant_venta_detalles ON public.venta_detalles;
CREATE TRIGGER trg_sidea_tenant_venta_detalles BEFORE INSERT OR UPDATE ON public.venta_detalles FOR EACH ROW EXECUTE FUNCTION public.sidea_enforce_tenant_relations();
DROP TRIGGER IF EXISTS trg_sidea_tenant_cierres ON public.cierres_diarios;
CREATE TRIGGER trg_sidea_tenant_cierres BEFORE INSERT OR UPDATE ON public.cierres_diarios FOR EACH ROW EXECUTE FUNCTION public.sidea_enforce_tenant_relations();

CREATE INDEX IF NOT EXISTS idx_productos_tienda_tenant_activo_nombre ON public.productos_tienda(tenant_id, activo, nombre);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_tenant_codigo ON public.productos_tienda(tenant_id, codigo_barras);
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_created_at ON public.ventas(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_turno_estado ON public.ventas(tenant_id, turno_id, estado);
CREATE INDEX IF NOT EXISTS idx_turnos_tenant_estado_fecha ON public.turnos(tenant_id, estado, fecha_operativa DESC);
CREATE INDEX IF NOT EXISTS idx_cierres_tenant_fecha_desc ON public.cierres_diarios(tenant_id, fecha_operativa DESC);

CREATE OR REPLACE FUNCTION public.registrar_venta_offline_atomic(
    p_sync_id TEXT,
    p_turno_id UUID,
    p_metodo_pago TEXT,
    p_items JSONB
)
RETURNS TABLE (venta_id UUID, already_synced BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    v_payment TEXT := upper(btrim(coalesce(p_metodo_pago, '')));
    v_has_price_conflict BOOLEAN := false;
    v_price_conflicts JSONB := '[]'::JSONB;
BEGIN
    IF v_auth_user_id IS NULL THEN RAISE EXCEPTION 'No authenticated user'; END IF;
    IF p_sync_id IS NULL OR btrim(p_sync_id) = '' THEN RAISE EXCEPTION 'sync_id is required'; END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items must be a non-empty array';
    END IF;
    IF v_payment NOT IN ('EFECTIVO','TARJETA','TRANSFERENCIA','BILLETERA','QR') THEN
        RAISE EXCEPTION 'Invalid payment method';
    END IF;

    SELECT cu.tenant_id, cu.id INTO v_tenant_id, v_comercio_usuario_id
      FROM public.comercio_usuarios cu
     WHERE cu.auth_user_id = v_auth_user_id AND cu.activo = true
     LIMIT 1;

    IF v_tenant_id IS NULL OR v_comercio_usuario_id IS NULL THEN
        RAISE EXCEPTION 'User role not configured for active commerce';
    END IF;
    IF public.trikode_tenant_access_mode(v_tenant_id) <> 'FULL' THEN
        RAISE EXCEPTION 'Commerce is not enabled for sales';
    END IF;

    SELECT v.id INTO v_existing_venta_id
      FROM public.ventas v
     WHERE v.tenant_id = v_tenant_id
       AND v.comercio_usuario_id = v_comercio_usuario_id
       AND v.turno_id = p_turno_id
       AND v.metadata ->> 'offline_sync_id' = p_sync_id
     LIMIT 1;
    IF v_existing_venta_id IS NOT NULL THEN
        RETURN QUERY SELECT v_existing_venta_id, true;
        RETURN;
    END IF;

    PERFORM 1 FROM public.turnos t
     WHERE t.id = p_turno_id
       AND t.tenant_id = v_tenant_id
       AND t.comercio_usuario_id = v_comercio_usuario_id
       AND t.estado = 'ABIERTO'
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or closed turno for current user'; END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        BEGIN
            v_producto_id := (v_item ->> 'id')::UUID;
            v_cantidad := (v_item ->> 'quantity')::DECIMAL(12,3);
            v_precio_unitario := (v_item ->> 'precio_venta')::DECIMAL(12,2);
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid item payload';
        END;

        IF v_producto_id IS NULL OR v_cantidad IS NULL OR v_precio_unitario IS NULL OR v_cantidad <= 0 OR v_precio_unitario < 0 THEN
            RAISE EXCEPTION 'Invalid item values';
        END IF;

        SELECT pt.stock_actual, pt.precio_venta, pt.nombre
          INTO v_stock_actual, v_precio_vigente, v_producto_nombre
          FROM public.productos_tienda pt
         WHERE pt.id = v_producto_id AND pt.tenant_id = v_tenant_id AND pt.activo = true
         FOR UPDATE;

        IF NOT FOUND THEN RAISE EXCEPTION 'Product not found in tenant'; END IF;
        IF v_stock_actual < v_cantidad THEN RAISE EXCEPTION 'Insufficient stock'; END IF;

        IF ROUND(COALESCE(v_precio_vigente,0)::NUMERIC,2) <> ROUND(v_precio_unitario::NUMERIC,2) THEN
            v_has_price_conflict := true;
            v_price_conflicts := v_price_conflicts || jsonb_build_array(jsonb_build_object(
                'producto_id', v_producto_id,
                'producto_nombre', COALESCE(v_item ->> 'nombre', v_producto_nombre, 'Producto sin nombre'),
                'cantidad', v_cantidad,
                'precio_capturado', v_precio_unitario,
                'precio_vigente', v_precio_vigente,
                'diferencia_unitaria', ROUND((v_precio_unitario - COALESCE(v_precio_vigente,0))::NUMERIC,2)
            ));
        END IF;
        v_total := v_total + (v_precio_unitario * v_cantidad);
    END LOOP;

    INSERT INTO public.ventas (tenant_id, comercio_usuario_id, turno_id, total, metodo_pago, estado, metadata)
    VALUES (v_tenant_id, v_comercio_usuario_id, p_turno_id, ROUND(v_total::NUMERIC,2), v_payment, 'COMPLETADA', jsonb_build_object(
        'offline_sync_id', p_sync_id,
        'offline_created_at', NOW(),
        'synced_at', NOW(),
        'offline_price_conflict', v_has_price_conflict,
        'offline_price_conflicts', v_price_conflicts
    )) RETURNING id INTO v_new_venta_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item ->> 'id')::UUID;
        v_cantidad := (v_item ->> 'quantity')::DECIMAL(12,3);
        v_precio_unitario := (v_item ->> 'precio_venta')::DECIMAL(12,2);
        INSERT INTO public.venta_detalles (tenant_id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (v_tenant_id, v_new_venta_id, v_producto_id, v_cantidad, v_precio_unitario, ROUND((v_precio_unitario*v_cantidad)::NUMERIC,2));
        UPDATE public.productos_tienda
           SET stock_actual = ROUND((stock_actual - v_cantidad)::NUMERIC,3), updated_at = NOW()
         WHERE id = v_producto_id AND tenant_id = v_tenant_id;
    END LOOP;

    RETURN QUERY SELECT v_new_venta_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_venta_offline_atomic(TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_venta_offline_atomic(TEXT, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_venta_offline_atomic(TEXT, UUID, TEXT, JSONB) TO service_role;

COMMIT;

SELECT 'SIDEA hardening 23 aplicado' AS resultado;
