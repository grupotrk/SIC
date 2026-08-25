# Trikode SIC - refactor de saneamiento

Esta copia parte del ZIP original y prioriza corregir inconsistencias reales sin rehacer la lógica de negocio.

## Cambios aplicados

- Se centralizaron los roles `OWNER`, `EMPLOYEE` y `SUPERADMIN` en `src/lib/roles.ts`.
- Se centralizó la matriz de acceso por área.
- `OWNER` puede operar `/employee` de forma consistente, incluyendo middleware y layouts.
- Los layouts ya no comparan la cookie firmada como texto plano: ahora la verifican con `getServerSessionRole()`.
- El middleware rechaza cookies de rol inválidas/manipuladas y limpia la sesión de aplicación.
- `/api/export-capabilities` también verifica la cookie firmada.
- `/api/session-role` quedó como fuente de verdad server-side para rol + perfil de usuario.
- `UserRoleContext` ya no vuelve a resolver roles consultando tablas por su cuenta; sincroniza contra `/api/session-role`.
- Se corrigió el redirect infinito de `SUPERADMIN` en `/dashboard`.
- Login usa la misma política compartida para validar `next` y para decidir el home de cada rol.
- Se ampliaron y documentaron `.env.example` y `.env.local.example`.
- La copia final excluye `.next`, caches y logs para no mezclar artefactos de compilación con el código fuente.

## Política de acceso resultante

| Área | OWNER | EMPLOYEE | SUPERADMIN |
| --- | --- | --- | --- |
| `/owner` | Sí | No | Sí |
| `/employee` | Sí | Sí | Sí |
| `/dashboard` | Sí | Sí | Sí |

## Variables de entorno

La copia conserva los `.env` existentes para que puedas comparar/levantar el proyecto en otra carpeta. Las plantillas `.env.example` y `.env.local.example` no contienen secretos reales.

Antes de publicar el proyecto o compartirlo con terceros, eliminá `.env` y `.env.local` y rotá cualquier secreto que haya sido compartido fuera de tu máquina.

## UI de aplicación + temas claro/oscuro

- Nueva shell de aplicación para `/owner` y `/employee` con sidebar persistente y topbar compacta.
- Selector Claro/Oscuro con preferencia guardada en `localStorage` (`sic-theme`) y fallback al tema del sistema.
- Dashboard del dueño reorganizado en Resumen, Productos, Empleados y Suscripción.
- KPI del día rediseñados para mayor densidad y lectura rápida.
- Caja integrada en la misma identidad visual de aplicación.
- Compatibilidad visual oscura añadida a superficies, formularios, tablas y avisos heredados.
- Responsive: la sidebar se convierte en navegación compacta en pantallas angostas.
- Se corrigió `check_precio_positivo` a `precio_venta >= 0`, coherente con el catálogo inicial que crea productos todavía sin precio configurado.
