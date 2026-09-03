import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'

interface RequestBody {
  empleadoNombre: string
  usuarioPropuesto: string
  contraseña: string
}

interface ResponseSuccess {
  success: true
  usuarioAsignado: string
  email: string
  comercioUsuarioId: string
  mensaje?: string
}

interface ResponseError {
  success: false
  error: string
  sugerencias?: string[]
}

// Validar formato de username para EMPLOYEE
const EMPLOYEE_USERNAME_REGEX = /^[a-zA-Z]{3,30}$/

// Función para buscar si username existe globalmente
async function usernameTaken(username: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase()
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('comercio_usuarios')
    .select('id')
    .eq('activo', true)
    .ilike('metadata->>login_username', normalized)
    .limit(1)

  if (error) return false

  return (data && data.length > 0) || false
}

// Función para generar sugerencias de username
async function generateUsernamesuggestions(
  baseName: string,
  maxAttempts: number = 5
): Promise<string[]> {
  const suggestions: string[] = []
  const base = baseName.toLowerCase()

  for (let i = 1; i <= maxAttempts; i++) {
    const suggestion = base + i
    const isTaken = await usernameTaken(suggestion)
    if (!isTaken) {
      suggestions.push(suggestion)
    }
  }

  return suggestions
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Verificar autenticación (Bearer token)
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseAdmin()

    // Verificar token en Supabase Auth
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 })
    }

    // Verificar que el usuario sea OWNER del comercio
    const { data: ownerData, error: ownerError } = await supabase
      .from('comercio_usuarios')
      .select('id, tenant_id, rol')
      .eq('auth_user_id', userData.user.id)
      .eq('rol', 'OWNER')
      .eq('activo', true)
      .single()

    if (ownerError || !ownerData) {
      return NextResponse.json(
        { success: false, error: 'not_owner' },
        { status: 403 }
      )
    }

    const tenantId = ownerData.tenant_id

    // Parsear body
    const body: RequestBody = await req.json()
    const { empleadoNombre, usuarioPropuesto, contraseña } = body

    // Validaciones básicas
    if (!empleadoNombre || empleadoNombre.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'invalid_nombre' },
        { status: 400 }
      )
    }

    if (!usuarioPropuesto || !EMPLOYEE_USERNAME_REGEX.test(usuarioPropuesto)) {
      return NextResponse.json(
        { success: false, error: 'invalid_username_format' },
        { status: 400 }
      )
    }

    if (!contraseña || contraseña.length < 8 || contraseña.length > 72) {
      return NextResponse.json(
        { success: false, error: 'invalid_password' },
        { status: 400 }
      )
    }

    // Normalizar username
    const normalizedUsername = usuarioPropuesto.trim().toLowerCase()

    // Verificar si username ya existe
    const exists = await usernameTaken(normalizedUsername)
    if (exists) {
      // Generar sugerencias
      const sugerencias = await generateUsernamesuggestions(normalizedUsername)

      return NextResponse.json(
        {
          success: false,
          error: 'username_taken',
          sugerencias,
        } as ResponseError,
        { status: 409 }
      )
    }

    // Generar email único para el empleado (usar tenant_id + username)
    const emailBase = `${normalizedUsername}.${tenantId.substring(0, 8)}`
    const email = `${emailBase}@trikode.local`

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: contraseña,
      email_confirm: true,
      user_metadata: {
        nombre: empleadoNombre,
        rol: 'EMPLOYEE',
        tenant_id: tenantId,
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: 'auth_creation_failed' },
        { status: 500 }
      )
    }

    // Crear registro en comercio_usuarios
    const { data: comercioUserData, error: comercioUserError } = await supabase
      .from('comercio_usuarios')
      .insert({
        tenant_id: tenantId,
        auth_user_id: authData.user.id,
        rol: 'EMPLOYEE',
        nombre: empleadoNombre,
        email,
        activo: true,
        metadata: {
          login_username: normalizedUsername,
        },
      })
      .select('id')
      .single()

    if (comercioUserError || !comercioUserData) {
      // Limpiar usuario de Auth si falla la creación en comercio_usuarios
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { success: false, error: 'comercio_usuario_creation_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      usuarioAsignado: normalizedUsername,
      email,
      comercioUsuarioId: comercioUserData.id,
      mensaje: `Empleado ${empleadoNombre} creado exitosamente con usuario "${normalizedUsername}"`,
    } as ResponseSuccess)
  } catch {
    return NextResponse.json(
      { success: false, error: 'internal_error' },
      { status: 500 }
    )
  }
}
