'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUserRole } from '@/lib/UserRoleContext'
import { type ExportCapability } from '@/lib/exportPolicy'
import { type SubscriptionComputed } from '@/lib/subscriptionLifecycle'
import { type Turno } from '@/types'

import { useOfflineSync } from '@/hooks/useOfflineSync'
import ShiftOpener from '@/components/employee/ShiftOpener'
import PointOfSale from '@/components/employee/PointOfSale'
import ShiftCloser from '@/components/employee/ShiftCloser'
import AppShell from '@/components/AppShell'
import AppLoadingScreen from '@/components/AppLoadingScreen'

export default function EmployeePage() {
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
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null)
  const [currentView, setCurrentView] = useState<'apertura' | 'pos' | 'cierre'>('apertura')

  const [exportCapabilities, setExportCapabilities] = useState<ExportCapability[]>([])
  const [subscription, setSubscription] = useState<SubscriptionComputed | null>(null)

  const [exportingArqueoPdf, setExportingArqueoPdf] = useState(false)

  // Despachar un evento custom para que PointOfSale refresque los productos cuando haya un sync exitoso
  const onSyncSuccess = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sic:reload_productos'))
    }
  }

  const {
    isOnline,
    pendingSalesCount,
    pendingIncidentCount,
    syncingOfflineSales,
    syncingOfflineIncidents,
    offlineStartedAt,
    lastSyncResult,
    mensajeSync,
    enqueueOfflineSale,
    syncOfflineSales,
  } = useOfflineSync({
    userRole,
    turnoActivoId: turnoActivo?.id,
    onSyncSuccess,
  })

  useEffect(() => {
    if (!roleLoading && userRole?.rol !== 'EMPLOYEE' && userRole?.rol !== 'SUPERADMIN' && userRole?.rol !== 'OWNER') {
      router.push('/login')
      return
    }
    if (!roleLoading && userRole) {
      checkTurnoActivo()
      loadExportCapabilities()
      loadSubscriptionStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, userRole, router])

  const loadSubscriptionStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/account/subscription-status', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) return
      const payload = (await response.json()) as { ok: boolean; subscription?: SubscriptionComputed }
      if (payload.ok && payload.subscription) {
        setSubscription(payload.subscription)
      }
    } catch {
      // no-op
    }
  }

  const loadExportCapabilities = async () => {
    try {
      const response = await fetch('/api/export-capabilities', { method: 'GET' })
      if (!response.ok) return
      const payload = (await response.json()) as { ok: boolean; capabilities?: ExportCapability[] }
      if (payload.ok && payload.capabilities) {
        setExportCapabilities(payload.capabilities)
      }
    } catch {
      // no-op
    }
  }

  const checkTurnoActivo = async () => {
    if (!userRole) return
    try {
      const { data, error } = await supabase
        .from('turnos')
        .select('*')
        .eq('comercio_usuario_id', userRole.id)
        .eq('estado', 'ABIERTO')
        .maybeSingle()

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      if (!data) {
        setCurrentView('apertura')
        setLoading(false)
        return
      }

      setTurnoActivo(data as Turno)
      setCurrentView('pos')
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  const exportarArqueoTurnoPdf = async () => {
    setExportingArqueoPdf(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const today = new Date().toISOString().slice(0, 10)
      if (!turnoActivo?.id) return
      const response = await fetch(`/api/exports/arqueo-turno-pdf?turnoId=${encodeURIComponent(turnoActivo.id)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) {
        console.error('Error exportando arqueo PDF:', response.status, await response.text())
        return
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/pdf')) {
        console.error('La exportación no devolvió un PDF válido.')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arqueo-turno-${today}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // no-op
    } finally {
      setExportingArqueoPdf(false)
    }
  }

  const cerrarSesion = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      await fetch('/api/logout', { method: 'POST' })
      router.replace('/login')
    } catch {
      setLoggingOut(false)
    }
  }

  if (loading || roleLoading || !minimumLoadingDone) return <AppLoadingScreen title="Preparando la caja" subtitle="Verificando el turno y sincronizando el catálogo…" />

  return (
    <AppShell
      title={currentView === 'pos' ? 'Caja' : currentView === 'cierre' ? 'Cierre de turno' : 'Apertura de turno'}
      subtitle="Operación diaria y ventas"
      onLogout={cerrarSesion}
      loggingOut={loggingOut}
      navItems={[
        { label: 'Caja', href: '#caja', icon: 'cash' },
        { label: 'Conexión', href: '#conexion', icon: 'settings' },
        ...(userRole?.rol === 'OWNER' || userRole?.rol === 'SUPERADMIN' ? [{ label: 'Panel dueño', href: '/owner', icon: 'home' as const }] : []),
      ]}
    >
      <section id="conexion" className="app-section">
          {/* Banner Offline & Sincronización */}
          {mensajeSync && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                mensajeSync.tipo === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {mensajeSync.texto}
            </div>
          )}

          <div className={`mb-4 rounded-2xl border p-4 ${isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.12em]">
                Estado de conexión: {isOnline ? 'Online' : 'Offline'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs">
                  Ventas pendientes: {pendingSalesCount}
                </span>
                <span className="text-xs">
                  Avisos pendientes: {pendingIncidentCount}
                </span>
                <button
                  onClick={() => syncOfflineSales()}
                  disabled={!isOnline || (syncingOfflineSales && syncingOfflineIncidents) || (pendingSalesCount === 0 && pendingIncidentCount === 0)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {syncingOfflineSales || syncingOfflineIncidents ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
              </div>
            </div>
            {!isOnline && offlineStartedAt && (
              <p className="mt-2 text-xs">
                Aviso automático de conexión caída detectado a las {new Date(offlineStartedAt).toLocaleString('es-AR')}.
              </p>
            )}
          </div>

          {isOnline && (syncingOfflineSales || syncingOfflineIncidents) && (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 shadow-sm">
              <div className="flex items-center justify-center gap-3">
                <svg className="h-5 w-5 animate-spin text-sky-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-lg font-bold tracking-wide text-sky-900">
                  Conexión restaurada. Sincronizando ventas...
                </span>
              </div>
              <p className="mt-2 text-center text-xs text-sky-700">
                No cierre esta pantalla. Las ventas guardadas offline se están subiendo ahora.
              </p>
            </div>
          )}

          {isOnline && !syncingOfflineSales && !syncingOfflineIncidents && lastSyncResult && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm">
              <div className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 text-emerald-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg font-bold text-emerald-900">
                  {lastSyncResult.count} venta{lastSyncResult.count !== 1 ? 's' : ''} sincronizada{lastSyncResult.count !== 1 ? 's' : ''} correctamente
                </span>
              </div>
              <p className="mt-1 text-center text-xs text-emerald-700">
                Todas las operaciones offline quedaron registradas en el sistema.
              </p>
            </div>
          )}

          {!isOnline && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
              <div className="flex items-center justify-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-lg font-bold tracking-[0.18em] text-amber-900">
                  MODO OFFLINE ACTIVO
                </span>
              </div>
              <div className="mt-2 border-t border-amber-200 pt-2 text-center text-sm text-amber-900">
                <p className="font-semibold">El sistema sigue funcionando con normalidad.</p>
                <p className="mt-1 text-xs text-amber-700">
                  Todas las ventas se guardan localmente y se sincronizan automáticamente cuando vuelva el internet. No pierdas ninguna operación.
                </p>
              </div>
            </div>
          )}

          {/* Avisos de Suscripción */}
          {subscription?.status === 'EN_GRACIA' && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
              Su plan lleva vencido {subscription.daysOverdue} días. Abone para evitar la suspensión del servicio.
            </div>
          )}

          {subscription?.status === 'SOLO_DESCARGA' && (
            <div className="mb-4 rounded border border-sky-300 bg-sky-50 p-3 text-sky-900">
              Cuenta en modo solo descarga. Solo podés exportar información en PDF.
            </div>
          )}

          <div id="caja" className="app-section app-section-card">
          {/* Smart Components Condicionales */}
          {currentView === 'apertura' && (
            <ShiftOpener
              userRole={userRole}
              onShiftOpened={(turno) => {
                setTurnoActivo(turno)
                setCurrentView('pos')
              }}
            />
          )}

          {currentView === 'pos' && (
            <PointOfSale
              userRole={userRole}
              turnoActivo={turnoActivo}
              subscription={subscription}
              isOnline={isOnline}
              enqueueOfflineSale={enqueueOfflineSale}
              persistSaleOnline={async (sale) => {
                const { error } = await supabase.rpc('registrar_venta_offline_atomic', {
                  p_sync_id: sale.syncId,
                  p_turno_id: sale.turnoId,
                  p_metodo_pago: sale.metodoPago,
                  p_items: sale.items.map((item) => ({
                    id: item.id,
                    quantity: item.quantity,
                    precio_venta: item.precio_venta,
                  })),
                })
                if (error) throw error
              }}
              onGoToClose={() => setCurrentView('cierre')}
            />
          )}

          {currentView === 'cierre' && (
            <ShiftCloser
              turnoActivo={turnoActivo}
              exportCapabilities={exportCapabilities}
              onClosed={() => {
                setTurnoActivo(null)
                setCurrentView('apertura')
              }}
            />
          )}

          {exportCapabilities.some(c => c.key === 'arqueo_turno_personal') && (
            <div className="mt-4">
              <button
                onClick={exportarArqueoTurnoPdf}
                disabled={exportingArqueoPdf}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition"
              >
                {exportingArqueoPdf ? 'Exportando...' : 'Exportar arqueo del turno (PDF)'}
              </button>
            </div>
          )}
          </div>

      </section>
    </AppShell>
  )
}
