import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyCookieValue } from '@/lib/cookieSigning'
import { canAccessArea, isAppRole, ROLE_HOME, type AppRole } from '@/lib/roles'

const PROTECTED_PREFIXES = ['/dashboard', '/owner', '/employee'] as const

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function hasTrikodeSession(req: NextRequest): boolean {
  return req.cookies.get('trikode_session')?.value === '1'
}

async function getSessionRole(req: NextRequest): Promise<AppRole | null> {
  const signedRole = req.cookies.get('trikode_role')?.value
  if (!signedRole) return null

  const verifiedRole = await verifyCookieValue(signedRole)
  return isAppRole(verifiedRole) ? verifiedRole : null
}

function clearSessionAndRedirectToLogin(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', req.url))
  response.cookies.delete('trikode_session')
  response.cookies.delete('trikode_role')
  return response
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const protectedPath = isProtectedPath(pathname)
  const hasSession = hasTrikodeSession(req)

  if (protectedPath && !hasSession) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (!hasSession) return NextResponse.next()

  const role = await getSessionRole(req)

  if (!role) {
    if (protectedPath || pathname === '/login') {
      return clearSessionAndRedirectToLogin(req)
    }
    return NextResponse.next()
  }

  // /dashboard deja de ser una estación intermedia: resolvemos el home aquí.
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
  }

  // Una sesión ya iniciada nunca vuelve al formulario de login.
  if (pathname === '/login') {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
  }

  // Si entra a un área incorrecta, va directamente a su home; nunca a /dashboard.
  if ((pathname === '/owner' || pathname.startsWith('/owner/')) && !canAccessArea(role, 'owner')) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
  }

  if ((pathname === '/employee' || pathname.startsWith('/employee/')) && !canAccessArea(role, 'employee')) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|js)$).*)',
  ],
}
