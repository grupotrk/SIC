# Scripts de Trikode Ingeniería

Colección de scripts para testing, debugging, setup y mantenimiento de tenants en la BD de Trikode.

## 📋 Categorías

### 🔍 DEBUG - Lectura (sin cambios en BD)

Estos scripts **solo leen datos**, son seguros de correr en cualquier momento.

#### `debug-comercios.mjs`
Lista **todos los comercios** con sus IDs, nombres, estado activo, y metadatos.

```bash
node scripts/debug-comercios.mjs
```

**Uso:** Ver panorama general de qué comercios existen y su estado.

---

#### `debug-audit-carniceria.mjs`
Debug detallado de **un usuario audit específico** (carnicería). Muestra auth user, tenant_id, comercio, rol, suscripción y problemas encontrados.

```bash
node scripts/debug-audit-carniceria.mjs
```

**Uso:** Troubleshooting de un tenant de auditoría específico.

---

#### `debug-all-audit-tenants.mjs`
Debug de **TODOS los usuarios audit** (`audit.*@trikode.com.ar`). Tabla resumen con estado de cada tenant.

```bash
node scripts/debug-all-audit-tenants.mjs
```

**Uso:** Chequeo general de salud de tenants de auditoría antes de subir a producción.

---

#### `_check-seed-status.mjs`
Verifica si los 7 tenants de auditoría tienen **productos seededeados**.

```bash
node scripts/_check-seed-status.mjs
```

**Uso:** Confirmar que los seeds de catálogo corrieron OK.

---

#### `check-kiosco-catalog.mjs`
Detalle del catálogo del tenant **Kioscos** (tenant_id: `7c32ba40-6f5f-45f1-b80d-8e1f31c1f221`).

```bash
node scripts/check-kiosco-catalog.mjs
```

**Uso:** Verificar que el seed de kioscos se cargó correctamente.

---

### 🔧 SETUP & CREATE - Creación de datos

#### `create-juanferrero-all-tenants.mjs`
Crea usuario **Juan Ferrero** (`juancferrero`, `juancferrero1`, etc.) como **EMPLOYEE** en los **7 tenants que NO tenían empleado**.

```bash
node scripts/create-juanferrero-all-tenants.mjs
```

**Credenciales:**
- Email: `juancferrero.{primer8digostenantid}@trikode.local`
- Contraseña: `423512`
- Rol: `EMPLOYEE`

**Uso:** Setup inicial de empleados de prueba en auditoría.

---

#### `create-juanferrero-remaining.mjs`
Agrega **juancferrero7** y **juancferrero8** a Carnicería y Kioscos (que **ya tenían otro empleado**). Es complementario a `create-juanferrero-all-tenants.mjs`, no redundante.

```bash
node scripts/create-juanferrero-remaining.mjs
```

**Uso:** Agregar empleados adicionales a tenants específicos que ya están configurados.

---

#### `setup-audit-users-per-rubro.mjs`
Setup inicial de los 7 usuarios audit por rubro (carnicería, ferretería, librería, química, rotisería, etc.).

```bash
node scripts/setup-audit-users-per-rubro.mjs
```

**Uso:** Setup INICIAL de auditoría (solo primera vez).

---

### 🌱 SEED - Catálogos de productos

#### `seed-expanded-catalogs.mjs` ⭐ **RECOMENDADO**
Borra y **re-siembra los 7 tenants audit** con catálogos expandidos con:
- ~80+ productos por categoría
- Marcas reales argentinas (BIC, Stanley, Coca-Cola, etc.)
- Precios realistas (actualizados abril 2026)
- Manejo inteligente de límites BD (lotes de 50)

```bash
node scripts/seed-expanded-catalogs.mjs
```

**Operación:**
1. Borra tabla `productos_tienda` para cada tenant
2. Borra tabla hija `actualizaciones_precios`
3. Inserta catálogo limpio

**Uso:** Seed principal de catálogos para pruebas. Usar esto, no otras variantes.

---

#### `seed-catalogo-carniceria.mjs`
Seed de **carnicería específicamente** con cortes vacunos, cerdo, embutidos, pollo. Precios por kg (referencia abril 2026).

```bash
node scripts/seed-catalogo-carniceria.mjs
```

**Tenants target:**
- `audit.carniceria@trikode.com.ar` (tenant: `68856a35-f406-4b5a-ae1e-eae256e75b9c`)
- `audit.carniceriaverduleria@trikode.com.ar` (tenant: `28861dc4-003c-438a-aa57-c8458928de9e`)

**Uso:** Seed especializado si necesitás catálogo específico de carnicería.

---

### 🔨 FIX - Correcciones de estado BD

#### `fix-all-audit-subscriptions.mjs`
Activa suscripción en todos los tenants audit filtrando por **usuarios de auth** (`audit.*@trikode.com.ar`).

```bash
node scripts/fix-all-audit-subscriptions.mjs
```

**Cambios:**
- `activo = true`
- `estado_suscripcion = 'ACTIVO'`
- `suscripcion_vence_at = +5 años`

**Scope:** Todos los tenants de usuarios `audit.*@trikode.com.ar` en auth.

**Uso:** Activar suscripción a tenants de auditoría.

---

#### `fix-audit-tenants-subscription.mjs` ⚠️
Activa suscripción en tenants filtrando por email **`test@trikode.com.ar`** EN LA TABLA `comercios`.

```bash
node scripts/fix-audit-tenants-subscription.mjs
```

**Cambios:**
- `activo = true`
- `estado_suscripcion = 'activo'` (minúscula)
- `suscripcion_vence_at = null`
- `depurado_at = null`
- Otros campos limpiados

**Scope:** Diferentes del anterior — solo tenants con email `test@...` en BD.

**⚠️ ADVERTENCIA:** Este script puede afectar diferentes tenants que `fix-all-audit-subscriptions.mjs`. Verificar scope antes de correr.

---

#### `fix-audit-tenant-subscription.mjs` ⚠️
Similar a `fix-audit-tenants-subscription.mjs` pero busca por tenant_id específico (`0279d07c-d865-4785-99ee-defbec0659dd`). Probablemente **HISTÓRICO/OBSOLETO**.

```bash
node scripts/fix-audit-tenant-subscription.mjs
```

**Uso:** Posiblemente no necesario. Verificar antes de usar.

---

#### `fix-employee-tenant-metadata.mjs`
Busca employees sin `tenant_id` en user_metadata y los corrige.

```bash
node scripts/fix-employee-tenant-metadata.mjs
```

**Uso:** Fix de metadata corrupta en empleados.

---

#### `fix-rls-employee-access.mjs`
Arregla RLS: cambia validación de `auth.uid() = tenant_id` a `tenant_id = current_tenant_id()`. Necesario para que empleados puedan leer productos e insertar ventas.

```bash
node scripts/fix-rls-employee-access.mjs
```

**Nota:** Script incompleto/WIP — genera SQL listo para pegar en dashboard de Supabase.

**Uso:** Fix de RLS si empleados no tienen acceso.

---

### 🛠️ UTILIDADES

#### `hash-admin-password.mjs`
Hash una contraseña de admin.

```bash
npm run admin:hash
```

**Uso:** Generar hash seguro de contraseña para admin.

---

#### `generate-referral-codes.mjs`
Genera códigos referral para owners.

```bash
npm run ref:generate
```

**Uso:** Generar códigos de invitación.

---

#### `delete-techstore-pilot.mjs`
Borra el tenant **techstore-pilot** (probablemente histórico de desarrollo).

```bash
node scripts/delete-techstore-pilot.mjs
```

**Uso:** Limpiar tenants de desarrollo obsoletos.

---

### 📊 SQL Scripts (en /scripts/)

#### `crear_tenants_auditoria.sql`
SQL para crear los 7 tenants de auditoría. Probablemente ya corrido.

**Uso:** Referencia histórica, no correr de nuevo.

---

#### `purge_expired_trial_tenants.sql`
Limpia tenants de trial expirados.

**Uso:** Mantenimiento periódico.

---

## 🚀 Flujo Típico de Setup

Para un setup limpio de auditoría desde cero:

```bash
# 1. Setup usuarios audit
node scripts/setup-audit-users-per-rubro.mjs

# 2. Verificar que se crearon
node scripts/debug-all-audit-tenants.mjs

# 3. Seed catálogos
node scripts/seed-expanded-catalogs.mjs

# 4. Verificar seeds
node scripts/_check-seed-status.mjs

# 5. Crear empleados Juan Ferrero
node scripts/create-juanferrero-all-tenants.mjs

# 6. Activar suscripción
node scripts/fix-all-audit-subscriptions.mjs

# 7. Chequeo final
node scripts/debug-all-audit-tenants.mjs
```

---

## ⚠️ NOTAS IMPORTANTES

### Credenciales
Todos estos scripts tienen credenciales de Supabase hardcodeadas (service_role_key). **Son herramientas de emergencia para testing/debugging en vivo** — están listos para cuando se suba a producción y haya que arreglar algo rápido en equipo.

### Ambientes
- **Desarrollo:** Correr con cuidado, no rompe nada importante
- **Producción:** Usar SOLO con autorización y en caso de emergencia
- **Testing:** Usar `seed-expanded-catalogs.mjs` para resetear a estado limpio

### Bases de datos
Todos apuntan a la BD de **auditoría Trikode**. Verificar `SUPABASE_URL` antes de correr en otro ambiente.

---

## 📝 Scripts TypeScript

Algunos scripts están en `.ts` y requieren `tsx`:

```bash
npm run test:create-user    # scripts/test_create_user.ts
npm run seed:auditoria      # scripts/seed_auditoria_tenants.ts
```

---

## 🗑️ Scripts Eliminados

- ~~`seed-all-catalogs-fix-email.mjs`~~ — Reemplazado por `seed-expanded-catalogs.mjs` (versión mejorada con marcas reales y precios actualizados)

---

**Última actualización:** 16 de abril de 2026
