-- Script: purge_expired_trial_tenants.sql
-- Elimina o marca como depurados los tenants cuyo trial expiró y no tienen pagos

-- Marcar como depurados (soft delete)
UPDATE comercios
SET depurado_at = NOW(), activo = false
WHERE depurado_at IS NULL
  AND suscripcion_vence_at < CURRENT_DATE
  AND estado_suscripcion = 'ACTIVO';

-- Si quieres eliminar físicamente los datos, puedes usar:
-- DELETE FROM comercios WHERE depurado_at IS NOT NULL AND ... (agrega condiciones adicionales según tu política)

-- Puedes programar este script para que corra diariamente (ej: con cron o tarea programada)
