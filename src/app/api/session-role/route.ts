import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseAuthVerifier } from '@/lib/supabaseServer'
import { signCookieValue } from '@/lib/cookieSigning'
import { isAppRole, type AppRole } from '@/lib/roles'

const SESSION_MAX_AGE = 60 * 60 * 8

type ComercioUsuario = {
  id: string
  tenant_id: string
  auth_user_id: string
  nombre: string
  email: string
  rol: AppRole
  activo: boolean
  metadata?: Record<string, unknown> | null
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

function setSessionCookies(response: NextResponse, role: AppRole, signedRole: string) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  }

  response.cookies.set('trikode_session', '1', options)
  response.cookies.set('trikode_role', signedRole, options)
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const verifier = getSupabaseAuthVerifier()
    const {
      data: { user },
      error: authError,
    } = await verifier.auth.getUser(accessToken)

    if (authError || !user) {
      console.error('[session-role] token validation failed', authError?.message)
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_token',
          ...(process.env.NODE_ENV !== 'production' && authError?.message
            ? { detail: authError.message }
            : {}),
        },
        { status: 401 }
      )
    }

    const supabase = getSupabaseAdmin()

    const tenantId = user.user_metadata?.tenant_id as string | undefined

    const superAdminRes = await supabase
      .from('super_admin_users')
      .select('activo')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (superAdminRes.error) {
      console.error('[session-role] super_admin_users query failed', superAdminRes.error.message)
    }
    const isSuperAdmin = !superAdminRes.error && Boolean(superAdminRes.data?.activo)

    let comercioUsuario: ComercioUsuario | null = null

    if (tenantId) {
      const scopedByTenant = await supabase
        .from('comercio_usuarios')
        .select('id,tenant_id,auth_user_id,nombre,email,rol,activo,metadata')
        .eq('auth_user_id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (scopedByTenant.error) {
        console.error('[session-role] scoped comercio_usuarios query failed', scopedByTenant.error.message)
      }
      if (!scopedByTenant.error && scopedByTenant.data) {
        comercioUsuario = scopedByTenant.data as ComercioUsuario
      }
    }

    if (!comercioUsuario) {
      const fallbackByUser = await supabase
        .from('comercio_usuarios')
        .select('id,tenant_id,auth_user_id,nombre,email,rol,activo,metadata')
        .eq('auth_user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (fallbackByUser.error) {
        console.error('[session-role] fallback comercio_usuarios query failed', fallbackByUser.error.message)
      }
      if (!fallbackByUser.error && fallbackByUser.data) {
        comercioUsuario = fallbackByUser.data as ComercioUsuario
      }
    }

    if (!isSuperAdmin && (!comercioUsuario || !comercioUsuario.activo)) {
      return NextResponse.json({ ok: false, error: 'role_not_configured' }, { status: 403 })
    }

    if (!isSuperAdmin && comercioUsuario) {
      const commerceRes = await supabase
        .from('comercios')
        .select('activo,depurado_at')
        .eq('tenant_id', comercioUsuario.tenant_id)
        .maybeSingle()

      if (commerceRes.error || !commerceRes.data || commerceRes.data.activo !== true || commerceRes.data.depurado_at) {
        return NextResponse.json({ ok: false, error: 'commerce_inactive' }, { status: 403 })
      }
    }

    const role: AppRole = isSuperAdmin ? 'SUPERADMIN' : comercioUsuario!.rol
    if (!isAppRole(role)) {
      return NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 403 })
    }

    const profile = comercioUsuario
      ? {
          id: comercioUsuario.id,
          tenantId: comercioUsuario.tenant_id,
          authUserId: comercioUsuario.auth_user_id,
          nombre: comercioUsuario.nombre,
          email: comercioUsuario.email,
          rol: role,
          activo: comercioUsuario.activo,
          metadata: comercioUsuario.metadata ?? undefined,
        }
      : {
          id: user.id,
          tenantId: tenantId ?? '',
          authUserId: user.id,
          nombre:
            (user.user_metadata?.nombre as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            'Superadmin',
          email: user.email ?? '',
          rol: role,
          activo: true,
          metadata: user.user_metadata as Record<string, unknown>,
        }

    const response = NextResponse.json({ ok: true, role, profile }, { status: 200 })
    setSessionCookies(response, role, await signCookieValue(role))
    return response
  } catch (error) {
    console.error('[session-role] unexpected error', error)
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
