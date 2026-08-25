'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUserRole } from '@/lib/UserRoleContext'
import { type SubscriptionComputed } from '@/lib/subscriptionLifecycle'

import DashboardStats from '@/components/owner/DashboardStats'
import ProductsManager from '@/components/owner/ProductsManager'
import EmployeesManager from '@/components/owner/EmployeesManager'
import SubscriptionFeedback from '@/components/owner/SubscriptionFeedback'
import AppShell from '@/components/AppShell'
import AppLoadingScreen from '@/components/AppLoadingScreen'

export default function OwnerPage() {
  const router = useRouter()
  const { userRole, loading: roleLoading } = useUserRole()
  
  const [loading, setLoading] = useState(true)
  const [minimumLoadingDone, setMinimumLoadingDone] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Evita flashes entre rutas y permite que la pantalla de marca se perciba.
  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumLoadingDone(true), 2000)
    return () => window.clearTimeout(timer)
  }, [])
  const [subscription, setSubscription] = useState<SubscriptionComputed | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)

  useEffect(() => {
    // La autorización de /owner ya la resuelven middleware + layout en servidor.
    // Acá solo esperamos el perfil para cargar datos de UI; no redirigimos desde cliente.
    if (!roleLoading) {
      if (userRole) void loadSubscriptionStatus()
      setLoading(false)
    }
  }, [roleLoading, userRole])

  const loadSubscriptionStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/account/subscription-status', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) return

      const payload = (await response.json()) as {
        ok: boolean
        subscription?: SubscriptionComputed
      }

      if (payload.ok && payload.subscription) {
        setSubscription(payload.subscription)
      }
    } catch {
      // Si falla, el dashboard sigue operativo.
    }
  }

  const cerrarSesion = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      await fetch('/api/logout', { method: 'POST' })
      router.replace('/login')
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo cerrar sesión. Reintenta.' })
    } finally {
      setLoggingOut(false)
    }
  }

  if (loading || roleLoading || !minimumLoadingDone) return <AppLoadingScreen title="Preparando el panel" subtitle="Cargando el resumen, catálogo y equipo del comercio…" />

  return (
    <AppShell
      title="Panel del Dueño"
      subtitle="Operación, catálogo y equipo en un solo lugar"
      badge={userRole?.email === 'test@trikode.com.ar' ? 'DEMO / AUDIT' : undefined}
      onLogout={cerrarSesion}
      loggingOut={loggingOut}
      onCash={() => router.push('/employee')}
      navItems={[
        { label: 'Resumen', href: '#resumen', icon: 'home' },
        { label: 'Productos', href: '#productos', icon: 'box' },
        { label: 'Empleados', href: '#empleados', icon: 'users' },
        { label: 'Suscripción', href: '#suscripcion', icon: 'card' },
      ]}
    >
      {mensaje && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {mensaje.texto}
        </div>
      )}

      {subscription?.status === 'ACTIVO' && subscription?.dueDate && (() => {
        const due = new Date(subscription.dueDate + 'T00:00:00Z')
        const today = new Date()
        const diff = Math.ceil((due.getTime() - today.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
        const threshold = subscription.isTrial ? 7 : 3
        return diff > 0 && diff <= threshold ? (
          <div className="mb-4 rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
            {subscription.isTrial ? <><b>Tu período de prueba termina pronto.</b> Te quedan {diff} {diff === 1 ? 'día' : 'días'} de acceso gratuito.</> : <><b>Tu suscripción vence pronto.</b> Restan {diff} {diff === 1 ? 'día' : 'días'}.</>}
          </div>
        ) : null
      })()}

      {subscription?.status === 'EN_GRACIA' && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Su plan lleva vencido {subscription.daysOverdue} días. Abone para evitar la suspensión del servicio.</div>}
      {subscription?.status === 'SOLO_DESCARGA' && <div className="mb-4 rounded-xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">Cuenta en modo solo descarga. Te quedan {subscription.downloadDaysRemaining} días para exportar tus datos.</div>}
      {subscription?.cancelRequested && <div className="mb-4 rounded-xl border border-indigo-300 bg-indigo-50 p-3 text-sm text-indigo-900">Tu baja voluntaria ya fue registrada. Si renovás el pago, la cuenta se reactiva automáticamente.</div>}

      <section id="resumen" className="app-section app-section-card">
        <div className="app-section-heading"><div><h2>Resumen operativo</h2><p>Actividad del día actualizada automáticamente.</p></div></div>
        <DashboardStats subscription={subscription} />
      </section>

      <section id="productos" className="app-section app-section-card">
        <div className="app-section-heading"><div><h2>Catálogo e inventario</h2><p>Productos, precios y stock del comercio.</p></div></div>
        <ProductsManager />
      </section>

      <section id="empleados" className="app-section app-section-card">
        <div className="app-section-heading"><div><h2>Equipo</h2><p>Usuarios habilitados y acceso a caja.</p></div></div>
        <EmployeesManager />
      </section>

      <section id="suscripcion" className="app-section app-section-card">
        <div className="app-section-heading"><div><h2>Cuenta y suscripción</h2><p>Estado del servicio y administración de la cuenta.</p></div></div>
        <SubscriptionFeedback subscription={subscription} onSubscriptionChanged={loadSubscriptionStatus} />
      </section>
    </AppShell>
  )
}
