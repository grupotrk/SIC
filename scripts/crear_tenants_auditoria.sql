-- Script para crear tenants de auditoría por cada rubro
-- Usuario: test@trikode.com.ar | Contraseña: kzw2322
-- Ejecutar en local y producción para acceso inmediato

DO $$
DECLARE
    rubro RECORD;
    rubros TEXT[] := ARRAY[
        'Kioscos',
        'Rotisería',
        'Rotisería/Carrito',
        'Química',
        'Carnicería',
        'Carnicería/Verdulería',
        'Ferretería',
        'Tienda de Mascotas',
        'Librería'
    ];
    tenant_id UUID;
    user_id UUID;
    admin_email TEXT := 'test@trikode.com.ar';
    admin_pass TEXT := 'kzw2322';
    rubro_nombre TEXT;
BEGIN
    FOREACH rubro_nombre IN ARRAY rubros LOOP
        -- Crear tenant si no existe
        INSERT INTO tenants (nombre, rubro_id, estado, trial_expiration, created_at)
        SELECT 'Auditoría ' || rubro_nombre, r.id, 'activo', NOW() + INTERVAL '365 days', NOW()
        FROM rubros r
        WHERE r.nombre = rubro_nombre
        ON CONFLICT (nombre) DO NOTHING;

        -- Obtener tenant_id
        SELECT t.id INTO tenant_id FROM tenants t
        JOIN rubros r ON t.rubro_id = r.id
        WHERE t.nombre = 'Auditoría ' || rubro_nombre;

        -- Crear usuario admin si no existe
        INSERT INTO usuarios (tenant_id, email, password_hash, rol, activo, created_at)
        VALUES (
            tenant_id,
            admin_email,
            crypt(admin_pass, gen_salt('bf')),
            'admin',
            true,
            NOW()
        )
        ON CONFLICT (tenant_id, email) DO NOTHING;
    END LOOP;
END $$;

-- Fin del script. Acceso: test@trikode.com.ar / kzw2322 en cada tenant de auditoría.