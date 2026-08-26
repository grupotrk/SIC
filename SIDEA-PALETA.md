SIDEA SIC — Rebrand / Palette Patch 11

PALETA PRINCIPAL
- Navy 950: #07111F
- Navy 900: #0D1B2A
- Navy 800: #1B263B
- Blue 600: #2563EB
- Blue 500: #3B82F6
- Blue 400: #60A5FA
- Gray 700: #374151
- Gray 500: #6B7280
- Gray 300: #D1D5DB
- Gray 100: #F3F4F6
- White: #FFFFFF

CRITERIO
Azul = acciones, foco y selección.
Navy/grises = estructura y superficies.
Verde/ámbar/rojo = SOLO estados semánticos (éxito, advertencia, error).

INCLUYE
- Modo claro y oscuro unificados.
- Sidebar, cards, inputs, botones, métricas y login.
- Landing sobria basada en SIDEA.
- Eliminación visual de verde/cyan como colores decorativos.
- Cambio del logo/branding principal de Trikode a SIDEA.
- Copy offline preciso: continuidad de ventas durante cortes, no “app 100% offline”.
- Logo SIDEA actual como asset temporal en public/sidea-logo.png.

INSTALACIÓN
Copiar el contenido de este ZIP sobre la raíz del proyecto y aceptar reemplazos.
Luego:
  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  npm run dev
y Ctrl+F5 en el navegador.

NOTA
Este patch evita tocar lógica de caja, Supabase, tenants, ventas o cierres.
