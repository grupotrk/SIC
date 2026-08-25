# SIC — UI Refresh

Esta versión conserva la lógica de Auth/Supabase de FIX3 y actualiza la experiencia visual de la aplicación.

## Cambios
- Shell de aplicación más compacta y consistente.
- Sidebar con branding real de Trikode y navegación persistente.
- Modo claro/oscuro persistente, aplicado antes de hidratar para evitar parpadeos.
- Dashboard operativo rediseñado en bloques de información más densos.
- Estado visual del cierre diario: pendiente/cerrado.
- Botón de cierre deshabilitado automáticamente si el cierre del día ya existe.
- `already_closed` pasa a ser información de estado, no un error visual.
- Tablas, inputs y superficies heredadas reciben estilos consistentes en ambos temas.
- Mejor adaptación para tablet y móvil.

## Importante
Este paquete NO contiene `.env` ni `.env.local` reales. Conservar/copyar el `.env.local` funcional de São Paulo.
