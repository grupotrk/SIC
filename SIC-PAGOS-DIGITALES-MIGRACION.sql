-- SIC - Pagos digitales (Transferencia / Billetera / QR)
-- Ejecutar UNA VEZ en Supabase SQL Editor.
-- No borra ventas ni modifica históricos.

CREATE OR REPLACE VIEW public.ventas_empleados_en_vivo WITH (security_invoker = true) AS
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
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago IN ('MERCADO_PAGO','BILLETERA','QR')), 0) AS total_mercado_pago
FROM public.comercio_usuarios cu
LEFT JOIN public.turnos t
    ON t.comercio_usuario_id = cu.id
   AND t.estado = 'ABIERTO'
LEFT JOIN public.ventas v
    ON v.turno_id = t.id
GROUP BY COALESCE(v.tenant_id, cu.tenant_id), cu.id, cu.nombre, cu.rol, t.id, t.abierto_at;

CREATE OR REPLACE VIEW public.resumen_cierre_diario WITH (security_invoker = true) AS
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
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA' AND v.metodo_pago IN ('MERCADO_PAGO','BILLETERA','QR')), 0) AS total_mercado_pago
FROM public.ventas v
GROUP BY v.tenant_id, DATE(v.created_at);

GRANT SELECT ON public.ventas_empleados_en_vivo TO authenticated;
GRANT SELECT ON public.resumen_cierre_diario TO authenticated;
