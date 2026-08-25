'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Phase = 'loading' | 'form' | 'success' | 'error'
type AccountRole = 'OWNER' | 'EMPLOYEE' | 'SUPERADMIN' | null

const OWNER_PASSWORD_REGEX = /^.{6,64}$/
const EMPLOYEE_PIN_REGEX = /^[A-Za-z0-9]{4,6}$/

export default function SetPasswordPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [accountRole, setAccountRole] = useState<AccountRole>(null)

  const resolveCurrentRole = async (): Promise<AccountRole> => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) return null

    const roleFromMetadata = user.user_metadata?.rol
    if (roleFromMetadata === 'OWNER' || roleFromMetadata === 'EMPLOYEE') {
      return roleFromMetadata
    }

    if (user.user_metadata?.internal_role === 'SUPERADMIN') {
      return 'SUPERADMIN'
    }

    const { data } = await supabase
      .from('comercio_usuarios')
      .select('rol')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (data?.rol === 'OWNER' || data?.rol === 'EMPLOYEE') {
      return data.rol
    }

    return null
  }

  // Supabase carga el token en el hash URL al redirigir desde el email de invitacion.
  // onAuthStateChange lo procesa automaticamente y emite SIGNED_IN con type="invite".
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setPhase('form')
      } else if (event === 'INITIAL_SESSION') {
        // Si ya habia sesion activa, mostramos igual el form para cambio de pass
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            setPhase('form')
          } else {
            setPhase('error')
          }
        })
      }
    })

    // Timeout por si el token del hash no se procesa (link vencido o reutilizado)
    const t = setTimeout(() => {
      setPhase((prev) => (prev === 'loading' ? 'error' : prev))
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'form') return
    resolveCurrentRole().then((role) => setAccountRole(role)).catch(() => setAccountRole(null))
  }, [phase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden.')
      return
    }

    const resolvedRole = accountRole || (await resolveCurrentRole())

    if (resolvedRole === 'EMPLOYEE') {
      if (!EMPLOYEE_PIN_REGEX.test(password)) {
        setErrorMsg('Para Empleado, el PIN debe tener entre 4 y 6 caracteres alfanuméricos.')
        return
      }
    } else {
      if (!OWNER_PASSWORD_REGEX.test(password)) {
        setErrorMsg('Para Dueño, la contraseña debe tener al menos 6 caracteres.')
        return
      }
    }

    setSubmitting(true)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setErrorMsg('No se pudo guardar la contraseña. Intentá nuevamente.')
      setSubmitting(false)
      return
    }

    setPhase('success')
    setTimeout(() => router.push('/login'), 2500)
  }

  if (phase === 'loading') {
    return (
      <main
        className="min-h-screen flex items-center justify-center text-slate-100"
        style={{ background: 'linear-gradient(135deg, #15345f 0%, #0b1730 100%)' }}
      >
        <p className="text-slate-400 animate-pulse">Verificando invitacion...</p>
      </main>
    )
  }

  if (phase === 'error') {
    return (
      <main
        className="min-h-screen flex items-center justify-center text-slate-100 px-4"
        style={{ background: 'linear-gradient(135deg, #15345f 0%, #0b1730 100%)' }}
      >
        <div className="max-w-md w-full rounded-2xl border border-red-800 bg-red-950/40 p-8 text-center">
          <p className="text-xl font-bold mb-3 text-red-300">Link invalido o vencido</p>
          <p className="text-sm text-slate-400 mb-6">Pedile al administrador que reenvie la invitacion.</p>
          <a href="/login" className="underline text-sm text-slate-300">Ir al login</a>
        </div>
      </main>
    )
  }

  if (phase === 'success') {
    return (
      <main
        className="min-h-screen flex items-center justify-center text-slate-100 px-4"
        style={{ background: 'linear-gradient(135deg, #15345f 0%, #0b1730 100%)' }}
      >
        <div className="max-w-md w-full rounded-2xl border p-8 text-center" style={{ borderColor: 'rgba(152,206,79,0.45)', background: 'rgba(152,206,79,0.12)' }}>
          <p className="text-xl font-bold mb-2" style={{ color: '#d7f6ab' }}>Contrasena guardada</p>
          <p className="text-sm text-slate-400">Redirigiendo al login...</p>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center text-slate-100 px-4"
      style={{ background: 'linear-gradient(135deg, #15345f 0%, #0b1730 100%)' }}
    >
      <div className="max-w-md w-full rounded-2xl border p-8" style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
        <Image
          src="/trikode-logo.png"
          alt="Trikode Ingenieria"
          width={160}
          height={44}
          className="h-11 w-auto mb-3 object-contain"
          priority
        />
        <h1 className="text-2xl font-bold mb-1">Activar tu cuenta</h1>
        <p className="text-sm text-slate-400 mb-6">
          Elegí tu clave de acceso para ingresar al SIC.
        </p>

        {accountRole === 'EMPLOYEE' ? (
          <p className="text-xs text-slate-400 mb-4">Regla Empleado: PIN alfanumérico de 4 a 6 caracteres.</p>
        ) : (
          <p className="text-xs text-slate-400 mb-4">Regla Dueño: contraseña alfanumérica de 8+ caracteres (letras y números).</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="rounded border border-red-700 bg-red-950/50 p-3 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Nueva contraseña</label>
            <input
              type="password"
              required
              minLength={accountRole === 'EMPLOYEE' ? 4 : 8}
              className="w-full rounded p-2 focus:outline-none focus:ring-2"
              style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Repetir contraseña</label>
            <input
              type="password"
              required
              minLength={accountRole === 'EMPLOYEE' ? 4 : 8}
              className="w-full rounded p-2 focus:outline-none focus:ring-2"
              style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded px-4 py-2 font-bold disabled:opacity-60"
            style={{ background: 'linear-gradient(45deg, #98ce4f, #33d3e7)', color: '#0b1730' }}
          >
            {submitting ? 'Guardando...' : 'Activar cuenta'}
          </button>
        </form>
      </div>
    </main>
  )
}
