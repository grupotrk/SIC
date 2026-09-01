'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [blocked, setBlocked] = useState(false)

  const MAX_ATTEMPTS = 5

  useEffect(() => {
    void checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      const res = await fetch('/api/admin-verify', {
        credentials: 'include',
        cache: 'no-store',
      })

      if (res.ok) {
        router.replace('/admin/dashboard')
      }
    } catch {
      // sin sesión activa
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (blocked || loading) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password, remember }),
      })

      if (response.ok) {
        const payload = await response.json().catch(() => null)
        if (payload?.requires_password_change) {
          router.replace('/admin/change-password')
        } else {
          router.replace('/admin/dashboard')
        }
        return
      }

      const nextAttempts = loginAttempts + 1
      setLoginAttempts(nextAttempts)

      if (nextAttempts >= MAX_ATTEMPTS) {
        setBlocked(true)
        setError('Demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.')
        return
      }

      setError(`Usuario o contraseña incorrectos. Intento ${nextAttempts} de ${MAX_ATTEMPTS}.`)
    } catch {
      setError('Error de conexión. Verificá tu acceso a internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#15345f_0%,#0b1730_100%)] text-white">
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-4xl font-black mb-2 text-[#3B82F6]">SIDEA ADMIN</div>
            <p className="text-slate-300">Panel de Administración</p>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-8">
            <form onSubmit={handleLogin}>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Email o usuario de emergencia</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="nombre@sidea.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Contraseña</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="•••••••••"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Recordar sesión
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || blocked}
                className="w-full rounded-lg bg-[linear-gradient(45deg,#3B82F6,#60A5FA)] px-4 py-3 font-bold text-[#0b1730] disabled:opacity-60"
              >
                {loading ? 'Verificando...' : 'Ingresar al Panel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const email = username.trim()
                  if (!email.includes('@')) { setError('Ingresá tu email de administrador para recuperar la contraseña.'); return }
                  await fetch('/api/admin-forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
                  setError('Si el correo pertenece a un administrador activo, vas a recibir un email para recuperar la contraseña.')
                }}
                className="mt-3 w-full text-sm text-slate-300 underline underline-offset-4"
              >
                Olvidé mi contraseña
              </button>
            </form>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500 bg-red-900/40 p-4 text-sm text-red-100">
                {error}
              </div>
            )}

            <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
              <p className="text-xs text-slate-300 mb-2">
                <strong>Información de seguridad:</strong>
              </p>
              <ul className="space-y-1 text-xs text-slate-400">
                <li>• Máximo 5 intentos permitidos</li>
                <li>• Bloqueo temporal después de intentos fallidos</li>
                <li>• Sesión expira después de 24 horas</li>
                <li>• Acceso monitoreado y registrado</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-slate-400">
            <p>&copy; 2026 SIDEA Ingeniería - Panel Administrativo</p>
            <p className="text-xs mt-1">Acceso restringido y monitoreado</p>
          </div>
        </div>
      </div>
    </div>
  )
}