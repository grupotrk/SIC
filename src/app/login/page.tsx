'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { canAccessPath, ROLE_HOME, type AppRole } from '@/lib/roles'
import ThemeToggle from '@/components/ThemeToggle'

type LoginRole = 'OWNER' | 'EMPLOYEE'

const OWNER_USERNAME_OR_EMAIL_REGEX = /^(?:[a-zA-Z0-9]{4,40}|[^\s@]+@[^\s@]+\.[^\s@]+)$/
const OWNER_PASSWORD_REGEX = /^.{6,64}$/
const EMPLOYEE_USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/
const EMPLOYEE_PASSWORD_REGEX = /^.{8,72}$/

export default function LoginPage() {
  const router = useRouter()
  const [loginRole, setLoginRole] = useState<LoginRole>('OWNER')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSafeInternalPath = (path: string | null) => Boolean(path && path.startsWith('/') && !path.startsWith('//'))
  const isAllowedPathForRole = (role: AppRole, path: string) => canAccessPath(role, path)

  const resolveEmailForRole = async (role: LoginRole, rawIdentifier: string): Promise<string | null> => {
    const normalizedIdentifier = rawIdentifier.trim().toLowerCase()
    // Siempre pasa por el resolver server-side, incluso cuando Dueño usa email.
    // Así una cuenta SUPERADMIN no puede saltarse el control por usar su email directo.
    const response = await fetch('/api/login-identifier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, identifier: normalizedIdentifier }),
    })
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; email?: string; error?: string } | null

    if (!response.ok || !payload?.ok || !payload.email) {
      if (payload?.error === 'ambiguous_user') setError('Hay más de un usuario con ese identificador. Contactá al administrador.')
      else if (payload?.error === 'superadmin_account') setError('Esta cuenta es de administración SIDEA. Ingresá desde el acceso de Superadmin.')
      else if (payload?.error === 'not_found') setError('No encontramos ese usuario para el perfil seleccionado.')
      else setError('No se pudo resolver el usuario. Revisá los datos e intentá de nuevo.')
      return null
    }
    return payload.email
  }

  const clearOperationalSession = async () => {
    // Las cookies de sesión SIC son HttpOnly: supabase.auth.signOut() no puede borrarlas.
    // Limpiarlas explícitamente evita que una sesión OWNER anterior sobreviva a un login rechazado.
    await fetch('/api/logout', { method: 'POST' }).catch(() => null)
    await supabase.auth.signOut().catch(() => null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const normalizedIdentifier = identifier.trim()
      if (!normalizedIdentifier) {
        setError('Ingresá tu usuario o email.')
        return
      }

      if (loginRole === 'OWNER') {
        if (!OWNER_USERNAME_OR_EMAIL_REGEX.test(normalizedIdentifier)) {
          setError('Para Dueño, usá un usuario alfanumérico o un email válido.')
          return
        }
        if (!OWNER_PASSWORD_REGEX.test(password)) {
          setError('La clave del Dueño debe tener al menos 6 caracteres.')
          return
        }
      } else {
        if (!EMPLOYEE_USERNAME_REGEX.test(normalizedIdentifier)) {
          setError('Para Empleado, usá entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.')
          return
        }
        if (!EMPLOYEE_PASSWORD_REGEX.test(password)) {
          setError('La contraseña del Empleado debe tener entre 8 y 72 caracteres.')
          return
        }
      }

      const resolvedEmail = await resolveEmailForRole(loginRole, normalizedIdentifier)
      if (!resolvedEmail) return

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password })
      if (signInError) {
        const msg = signInError.message?.toLowerCase() || ''
        if (msg.includes('invalid login credentials') || msg.includes('invalid password') || msg.includes('user not found')) setError('Credenciales incorrectas. Verificá los datos e intentá de nuevo.')
        else if (msg.includes('email not confirmed')) setError('La cuenta no fue confirmada. Contactá al administrador.')
        else setError('No se pudo iniciar sesión. Intentá de nuevo.')
        return
      }

      if (!data.session?.user?.id) {
        setError('No se pudo obtener la sesión.')
        return
      }

      const roleSessionRes = await fetch('/api/session-role', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedRole: loginRole }),
      })
      if (!roleSessionRes.ok) {
        const errorPayload = (await roleSessionRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        await clearOperationalSession()
        if (errorPayload?.error === 'superadmin_account') setError('Esta cuenta es de administración SIDEA. Ingresá desde el acceso de Superadmin.')
        else if (errorPayload?.error === 'role_mismatch') setError('Esta cuenta no corresponde al perfil seleccionado.')
        else if (errorPayload?.error === 'role_not_configured') setError('Cuenta no configurada. Contactá al administrador.')
        else setError('No se pudo validar la sesión. Intentá nuevamente.')
        return
      }

      const rolePayload = (await roleSessionRes.json().catch(() => null)) as { ok?: boolean; role?: AppRole } | null
      const role = rolePayload?.role
      if (!role) {
        await clearOperationalSession()
        setError('No se pudo resolver el rol de la sesión.')
        return
      }

      // El perfil elegido en el login debe coincidir con el rol real de la cuenta.
      // Esto evita, por ejemplo, que un SUPERADMIN autentique desde el acceso de Dueño
      // y alcance una pantalla operativa sin pertenecer a un comercio.
      if (role !== loginRole) {
        await clearOperationalSession()
        setError(
          role === 'SUPERADMIN'
            ? 'Esta cuenta es de administración SIDEA. Ingresá desde el acceso de Superadmin.'
            : `Esta cuenta no tiene acceso como ${loginRole === 'OWNER' ? 'Dueño' : 'Empleado'}.`
        )
        return
      }

      const requestedNext = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null
      const redirectPath = isSafeInternalPath(requestedNext) && requestedNext && isAllowedPathForRole(role, requestedNext) ? requestedNext : ROLE_HOME[role]
      router.push(redirectPath)
    } catch (loginError) {
      console.error(loginError)
      setError('Error durante el login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-showcase" aria-hidden="true">
        <div className="login-showcase-inner">
          <Image src="/sidea-logo.png" alt="" width={190} height={60} className="login-brand-logo" priority />
          <div className="login-product-mark">SIC</div>
          <h1>Control operativo,<br />sin ruido.</h1>
          <p>Ventas, stock, caja y equipo en una sola herramienta pensada para el trabajo diario.</p>
          <div className="login-feature-grid">
            <div><strong>Operación en tiempo real</strong><span>Visibilidad clara de caja y ventas.</span></div>
            <div><strong>Continuidad offline</strong><span>Seguís vendiendo aunque se corte internet.</span></div>
            <div><strong>Un solo sistema</strong><span>Dueños y empleados con accesos separados.</span></div>
          </div>
        </div>
        <div className="login-glow login-glow-one" />
        <div className="login-glow login-glow-two" />
      </section>

      <section className="login-access">
        <div className="login-theme"><ThemeToggle /></div>
        <div className="login-card">
          <div className="login-mobile-brand"><Image src="/sidea-logo.png" alt="SIDEA Ingeniería" width={150} height={48} className="h-auto w-[132px]" priority /></div>
          <div className="login-heading">
            <span className="login-kicker">Acceso seguro</span>
            <h2>Ingresar al SIC</h2>
            <p>Elegí tu perfil e ingresá tus credenciales.</p>
          </div>

          <div className="login-role-switch" role="group" aria-label="Tipo de acceso">
            <button type="button" className={loginRole === 'OWNER' ? 'active' : ''} onClick={() => setLoginRole('OWNER')} disabled={loading}>Dueño</button>
            <button type="button" className={loginRole === 'EMPLOYEE' ? 'active' : ''} onClick={() => setLoginRole('EMPLOYEE')} disabled={loading}>Empleado</button>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {error && <div className="login-error"><span />{error}</div>}

            <label className="login-field">
              <span>{loginRole === 'OWNER' ? 'Usuario o email' : 'Usuario'}</span>
              <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={loginRole === 'OWNER' ? 'tu@email.com' : 'usuario'} autoCapitalize="none" autoCorrect="off" disabled={loading} autoComplete="username" />
            </label>

            <label className="login-field">
              <span>Contraseña</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={loginRole === 'EMPLOYEE' ? '8 caracteres o más' : 'Tu contraseña'} disabled={loading} autoComplete="current-password" />
            </label>

            <button type="submit" disabled={loading} className="login-submit">
              <span>{loading ? 'Ingresando…' : 'Ingresar'}</span>
              {!loading && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>}
            </button>
          </form>

          <div className="login-secondary-actions">
            <a href="/demo-comercio.html">Ver demo</a>
            <a href="/landing.html">Volver al sitio</a>
          </div>

          <div className="login-admin-access">
            <a href="/admin" aria-label="Acceso de administración SIDEA">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 5 6v5c0 4.6 2.9 8.4 7 10 4.1-1.6 7-5.4 7-10V6l-7-3Z" />
                <path d="M9.5 12.2 11.2 14l3.6-4" />
              </svg>
              <span>Acceso de administración</span>
            </a>
          </div>

          <div className="login-trust"><span className="status-dot" />Conexión protegida · SIDEA Ingeniería</div>
        </div>
      </section>
    </main>
  )
}
