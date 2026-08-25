import 'dotenv/config'
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan variables de entorno de Supabase');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RUBROS = [
  'Kioscos',
  'Rotisería',
  'Rotisería/Carrito',
  'Química',
  'Carnicería',
  'Carnicería/Verdulería',
  'Ferretería',
  'Tienda de Mascotas',
  'Librería',
];

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'test@trikode.com.ar';
const ADMIN_PASS = process.env.SEED_AUDIT_PASS || '';

let alreadySeeded = false;

export async function seedAuditoriaTenants() {
  if (alreadySeeded) return;
  alreadySeeded = true;
  // Buscar o crear usuario auth
  let userId: string | null = null;
  const { data: userList, error: userListError } = await supabase.auth.admin.listUsers();
  if (userListError) throw userListError;
  const found = userList.users.find(u => u.email?.toLowerCase() === ADMIN_EMAIL);
  if (found) {
    userId = found.id;
    console.log('Usuario ya existe en Auth:', ADMIN_EMAIL, userId);
  } else {
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
      email_confirm: true,
    });
    console.log('Resultado createUser:', newUser, createUserError);
    if (createUserError || !newUser?.user?.id) throw createUserError || new Error('No se pudo crear el usuario');
    userId = newUser.user.id;
    console.log('Usuario creado en Auth:', ADMIN_EMAIL, userId);
  }

  for (const rubro of RUBROS) {
    // Buscar rubro_id
    const { data: rubroRow, error: rubroError } = await supabase
      .from('rubros')
      .select('id')
      .eq('nombre', rubro)
      .maybeSingle();
    if (rubroError || !rubroRow) throw rubroError || new Error('Rubro no encontrado: ' + rubro);
    const rubro_id = rubroRow.id;

    // Buscar o crear tenant
    let tenant: { id: string; tenant_id: string } | null = null;
    const { data: existing, error: existError } = await supabase
      .from('comercios')
      .select('id,tenant_id')
      .eq('email', ADMIN_EMAIL)
      .eq('rubro_id', rubro_id)
      .maybeSingle();
    if (existError) throw existError;
    if (existing) {
      tenant = existing;
    } else {
      const { data: newTenant, error: tenantError } = await supabase
        .from('comercios')
        .insert({
          nombre: `Auditoría ${rubro}`,
          email: ADMIN_EMAIL,
          rubro_id,
          activo: true,
          metadata: { auditoria: true },
        })
        .select('id,tenant_id')
        .maybeSingle();
      if (tenantError || !newTenant) throw tenantError || new Error('No se pudo crear tenant para ' + rubro);
      tenant = newTenant;
    }

    // Forzar usuario OWNER en comercio_usuarios
    const upsertResult = await supabase
      .from('comercio_usuarios')
      .upsert({
        tenant_id: tenant.tenant_id,
        auth_user_id: userId,
        nombre: 'Auditor',
        email: ADMIN_EMAIL,
        rol: 'OWNER',
        activo: true,
        metadata: { auditoria: true },
      }, { onConflict: 'tenant_id,email' });
    console.log('Upsert comercio_usuarios:', upsertResult);
    if (upsertResult.error) throw upsertResult.error;
  }
}