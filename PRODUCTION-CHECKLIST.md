# SIDEA SIC · Checklist de salida a producción

Este archivo separa lo que el PATCH 23 deja integrado de lo que necesariamente debe comprobarse con datos reales.

## Integrado en código
- Pagos online quedan deshabilitados de forma limpia mientras `PAYMENTS_ENABLED=false`.
- La UI no intenta generar links de Mercado Pago si la pasarela no está habilitada.
- El trial no muestra dos bloques de renovación al mismo tiempo.
- Endpoint `/api/health` para monitoreo básico.
- Páginas 404 y error general con marca SIDEA.
- Headers de seguridad y ocultación de `X-Powered-By`.
- Script `npm run prod:check` para validar variables críticas sin imprimir secretos.
- ZIPs ignorados por Git para evitar volver a versionar snapshots del proyecto.

## Integrado en SQL (ejecutar `SIDEA-PRODUCTION-HARDENING-23.sql`)
- Tenant ID único.
- Comercio desactivado bloquea operación.
- Validación de relaciones cruzadas entre tenant/usuario/turno/venta/producto/cierre.
- Índices para catálogo, ventas, turnos y cierres.
- Venta atómica e idempotente reforzada.
- Stock bloqueado con `FOR UPDATE` para ventas simultáneas.
- Rechazo de turno cerrado y métodos de pago no admitidos.

## Pruebas manuales obligatorias antes del primer cliente
1. Dos comercios: producto, turno, venta, cierre y empleado nunca aparecen cruzados.
2. Dos cajas intentan vender el último artículo: solo debe concretarse stock válido.
3. Doble clic/reintento de una venta: no debe duplicarse gracias al `sync_id`.
4. Cortar conexión durante una venta y restaurarla: sincroniza una sola vez.
5. OWNER y EMPLOYEE: verificar pantallas y acciones permitidas.
6. Cierre diario: efectivo, tarjeta, transferencia, billetera y QR + PDF.
7. Ejecutar `npm run build` y `npm run prod:check` con variables del hosting.
8. Verificar backup/restauración del proyecto Supabase según el plan contratado.

## Pagos
Por ahora mantener `PAYMENTS_ENABLED=false`.

Cuando definan la cuenta receptora:
- `PAYMENTS_ENABLED=true`
- `PAYMENT_PROVIDER=mercadopago`
- configurar `MERCADOPAGO_ACCESS_TOKEN` solo en el servidor/hosting
- configurar `PAYMENT_SUCCESS_URL`
- probar checkout + webhook + renovación antes de habilitarlo a clientes.
