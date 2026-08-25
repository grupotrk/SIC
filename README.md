# SIC — Sistema Interno de Control

Herramienta de gestión interna para comercios. Control de turnos, ventas, empleados y reportes en un solo lugar.

## Estructura del proyecto

```
/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/   → redirección por rol
│   │   │   ├── owner/       → panel del dueño
│   │   │   └── employee/    → panel del empleado
│   │   ├── api/             → endpoints Next.js
│   │   ├── login/
│   │   └── admin/
│   ├── components/
│   │   ├── owner/
│   │   └── employee/
│   ├── hooks/
│   │   └── useOfflineSync.ts
│   ├── lib/
│   │   ├── cookieSigning.ts
│   │   ├── exportPolicy.ts
│   │   ├── subscriptionLifecycle.ts
│   │   ├── UserRoleContext.tsx
│   │   └── supabase.ts
│   └── types/
│       └── index.ts          → tipos compartidos (Turno, UserRole)
├── public/
│   ├── landing.html          → landing del producto
│   └── admin/                → panel administrativo
├── scripts/                  → seeds y utilidades (solo uso local)
└── middleware.ts             → protección de rutas por rol + HMAC
```

## Roles del sistema

| Rol | Acceso |
|---|---|
| `EMPLOYEE` | `/employee` — turno, POS, arqueo |
| `OWNER` | `/owner` — dashboard, reportes, empleados, suscripción |
| `SUPERADMIN` | Ambos + panel admin |

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores:

```bash
cp .env.example .env.local
```

## Desarrollo

```bash
npm install
npm run dev
```

## Scripts útiles

```bash
npm run admin:hash          # Hashear contraseña de admin
npm run ref:generate        # Generar códigos de referido
npm run seed:auditoria      # Seed de tenants de auditoría
```
