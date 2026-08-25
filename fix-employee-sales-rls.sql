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
