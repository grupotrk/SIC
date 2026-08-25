'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserRole } from '@/lib/UserRoleContext'
import { type SubscriptionComputed } from '@/lib/subscriptionLifecycle'

interface EmpleadoEnVivo {
  comercio_usuario_id: string
  empleado_nombre: string
  ventas_completadas: number
  total_vendido: number
  total_efectivo: number
  total_tarjeta: number
  total_transferencia: number
  total_mercado_pago: number
}

interface ResumenDiario {
  total_ventas: number
  total_general: number
  total_efectivo: number
  total_tarjeta: number
  total_transferencia: number
  total_mercado_pago: number
}

interface OfflinePriceConflictItem {
  producto_nombre: string
  cantidad: number
  precio_capturado: number
  precio_vigente: number
  diferencia_unitaria: number
}

interface OfflinePriceConflictSale {
  id: string
  total: number
  created_at: string
  empleado_nombre: string
  conflictos: OfflinePriceConflictItem[]
}

interface Props {
  subscription: SubscriptionComputed | null
}

export default function DashboardStats({ subscription }: Props) {
  const { userRole } = useUserRole()
  const [empleados, setEmpleados] = useState<EmpleadoEnVivo[]>([])
  const [resumen, setResumen] = useState<ResumenDiario | null>(null)
  const [cierreRealizado, setCierreRealizado] = useState(false)
  const [offlinePriceConflicts, setOfflinePriceConflicts] = useState<OfflinePriceConflictSale[]>([])
  const [exportingPdf, setExportingPdf] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success' | 'info'; texto: string } | null>(null)

  const isLoadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (userRole) {
      loadDashboardData()
      const interval = setInterval(() => {
        if (!isLoadingRef.current) {
          loadDashboardData()
        }
      }, 5000)
      return () => {
        clearInterval(interval)
        abortControllerRef.current?.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole])

  const loadDashboardData = async () => {
    if (!userRole || isLoadingRef.current) return
    isLoadingRef.current = true

    // Cancela el request anterior si sigue pendiente
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    try {
      const { data: empleadosData, error: empError } = await supabase
        .from('ventas_empleados_en_vivo')
        .select('*')
        .eq('tenant_id', userRole.tenantId)

      if (!empError && empleadosData) {
        setEmpleados(empleadosData as EmpleadoEnVivo[])
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: resumenData, error: resError } = await supabase
        .from('resumen_cierre_diario')
        .select('*')
        .eq('tenant_id', userRole.tenantId)
        .gte('fecha_operativa', today)
        .lte('fecha_operativa', today)
        .maybeSingle()

      if (resError) {
        console.error('Error cargando resumen_cierre_diario:', resError)
      } else {
        setResumen((resumenData as ResumenDiario) ?? null)
      }

      // El resumen diario existe aunque la jornada siga abierta.
      // El estado de cierre se determina SOLO por cierres_diarios + fecha_operativa.
      const { data: cierreData, error: cierreError } = await supabase
        .from('cierres_diarios')
        .select('id')
        .eq('tenant_id', userRole.tenantId)
        .eq('fecha_operativa', today)
        .limit(1)
        .maybeSingle()

      if (cierreError) {
        console.error('Error verificando cierre del día:', cierreError)
        setCierreRealizado(false)
      } else {
        setCierreRealizado(Boolean(cierreData))
      }

      const { data: conflictData, error: conflictError } = await supabase
        .from('ventas')
        .select('id,total,created_at,metadata,comercio_usuarios(nombre)')
        .eq('tenant_id', userRole.tenantId)
        .contains('metadata', { offline_price_conflict: true })
        .order('created_at', { ascending: false })
        .limit(5)

      if (!conflictError && conflictData) {
        const mappedConflicts = (conflictData as Array<Record<string, unknown>>).map((venta) => {
          const metadata = (venta.metadata as Record<string, unknown> | null) ?? {}
          const conflictoItems = Array.isArray(metadata.offline_price_conflicts)
            ? (metadata.offline_price_conflicts as OfflinePriceConflictItem[])
            : []
          const comercioUsuario = venta.comercio_usuarios as { nombre?: string } | Array<{ nombre?: string }> | null
          const empleadoNombre = Array.isArray(comercioUsuario)
            ? (comercioUsuario[0]?.nombre ?? 'Empleado')
            : (comercioUsuario?.nombre ?? 'Empleado')

          return {
            id: String(venta.id),
            total: Number(venta.total ?? 0),
            created_at: String(venta.created_at),
            empleado_nombre: empleadoNombre,
            conflictos: conflictoItems,
          }
        })

        setOfflinePriceConflicts(mappedConflicts)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return // request cancelado
      // no-op
    } finally {
      isLoadingRef.current = false
    }
  }

  const cerrarDiaConsolidado = async () => {
    if (!userRole) return

    if (!confirm('¿Confirmar el cierre del día? Esta acción registrará los totales actuales.')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMensaje({ tipo: 'error', texto: 'Sesión expirada. Iniciá sesión nuevamente.' })
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/api/owner/close-day', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tenantId: userRole.tenantId, fecha_operativa: today }),
      })

      const payload = await res.json() as { ok: boolean; error?: string; mensaje?: string }

      if (!res.ok || !payload.ok) {
        if (payload.error === 'already_closed') {
          setMensaje({ tipo: 'info', texto: payload.mensaje ?? 'El cierre de hoy ya fue realizado.' })
          await loadDashboardData()
        } else {
          setMensaje({ tipo: 'error', texto: 'No se pudo registrar el cierre del día.' })
        }
        return
      }

      setMensaje({ tipo: 'success', texto: 'Día cerrado correctamente.' })
      setTimeout(() => setMensaje(null), 3000)
      await loadDashboardData()
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error inesperado al cerrar el día.' })
    }
  }

  const exportarResumenDiarioPdf = async () => {
    setExportingPdf(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMensaje({ tipo: 'error', texto: 'Sesión expirada. Iniciá sesión nuevamente.' })
        return
      }

      const today = new Date().toISOString().slice(0, 10)
      const response = await fetch(`/api/exports/resumen-diario-pdf?date=${today}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) {
        setMensaje({ tipo: 'error', texto: 'No se pudo exportar el resumen diario en PDF.' })
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resumen-diario-${today}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setMensaje({ tipo: 'success', texto: 'PDF exportado correctamente.' })
      setTimeout(() => setMensaje(null), 3000)
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error exportando PDF.' })
    } finally {
      setExportingPdf(false)
    }
  }

  const cierreBloqueado = subscription?.accessMode !== 'FULL' || cierreRealizado

  return (
    <>
      {mensaje && (
        <div className={`app-alert app-alert-${mensaje.tipo}`}>
          <span className="app-alert-dot" />
          <span>{mensaje.texto}</span>
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card metric-primary">
          <div><span className="metric-label">Total del día</span><small>Facturación acumulada</small></div>
          <strong>${resumen?.total_general?.toFixed(2) || '0.00'}</strong>
        </div>
        <div className="metric-card">
          <div><span className="metric-label">Efectivo</span><small>Ingresos en caja</small></div>
          <strong>${resumen?.total_efectivo?.toFixed(2) || '0.00'}</strong>
        </div>
        <div className="metric-card">
          <div><span className="metric-label">Tarjeta</span><small>Pagos electrónicos</small></div>
          <strong>${resumen?.total_tarjeta?.toFixed(2) || '0.00'}</strong>
        </div>
        <div className="metric-card">
          <div><span className="metric-label">Transferencias</span><small>Transferencias bancarias</small></div>
          <strong>${resumen?.total_transferencia?.toFixed(2) || '0.00'}</strong>
        </div>
        <div className="metric-card">
          <div><span className="metric-label">Billetera / QR</span><small>Pagos digitales</small></div>
          <strong>${resumen?.total_mercado_pago?.toFixed(2) || '0.00'}</strong>
        </div>
        <div className="metric-card">
          <div><span className="metric-label">Transacciones</span><small>Operaciones registradas</small></div>
          <strong>{resumen?.total_ventas || 0}</strong>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div><span className="eyebrow">OPERACIÓN</span><h3>Empleados en vivo</h3></div>
            <span className={`status-pill ${empleados.length > 0 ? 'status-pill-live' : ''}`}>{empleados.length} activos</span>
          </div>
          {empleados.length === 0 ? (
            <div className="empty-state"><span className="empty-state-icon">○</span><div><strong>Sin turnos abiertos</strong><p>No hay empleados operando caja en este momento.</p></div></div>
          ) : (
            <div className="employee-live-list">
              {empleados.map((emp) => (
                <article key={emp.comercio_usuario_id} className="employee-live-row">
                  <div className="employee-avatar">{emp.empleado_nombre?.slice(0,1).toUpperCase()}</div>
                  <div className="employee-live-main"><strong>{emp.empleado_nombre}</strong><span>{emp.ventas_completadas} ventas</span></div>
                  <div className="employee-live-total"><strong>${emp.total_vendido?.toFixed(2)}</strong><span>${emp.total_efectivo?.toFixed(2)} ef. · ${emp.total_tarjeta?.toFixed(2)} tarj. · ${emp.total_transferencia?.toFixed(2)} transf. · ${emp.total_mercado_pago?.toFixed(2)} digital</span></div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div><span className="eyebrow">CONTROL</span><h3>Cierre operativo</h3></div>
            <span className={`status-pill ${cierreRealizado ? 'status-pill-ok' : 'status-pill-pending'}`}>{cierreRealizado ? 'Cerrado' : 'Pendiente'}</span>
          </div>
          <div className="close-day-status">
            <div className={`close-day-icon ${cierreRealizado ? 'done' : ''}`}>{cierreRealizado ? '✓' : '↗'}</div>
            <div>
              <strong>{cierreRealizado ? 'Cierre del día realizado' : 'El día todavía está abierto'}</strong>
              <p>{cierreRealizado ? 'Los totales quedaron consolidados. Podés exportar el resumen.' : 'Cuando termine la operación, consolidá los movimientos del día.'}</p>
            </div>
          </div>
          <div className="close-day-actions">
            <button onClick={cerrarDiaConsolidado} disabled={cierreBloqueado} className="app-button app-button-danger app-button-wide">
              {cierreRealizado ? 'Cierre realizado' : 'Cerrar día consolidado'}
            </button>
            <button onClick={exportarResumenDiarioPdf} disabled={exportingPdf} className="app-button app-button-wide">
              {exportingPdf ? 'Exportando…' : 'Exportar resumen PDF'}
            </button>
          </div>
        </section>
      </div>

      <section className="dashboard-panel dashboard-panel-spaced">
        <div className="dashboard-panel-head">
          <div><span className="eyebrow">SINCRONIZACIÓN</span><h3>Conflictos de precio offline</h3></div>
          <span className={`status-pill ${offlinePriceConflicts.length > 0 ? 'status-pill-warning' : 'status-pill-ok'}`}>{offlinePriceConflicts.length} recientes</span>
        </div>

        {offlinePriceConflicts.length === 0 ? (
          <div className="empty-state compact"><span className="empty-state-icon">✓</span><div><strong>Sin conflictos recientes</strong><p>Los precios capturados offline coinciden con los precios vigentes.</p></div></div>
        ) : (
          <div className="conflict-list">
            {offlinePriceConflicts.map((venta) => (
              <article key={venta.id} className="conflict-row">
                <div className="conflict-row-head"><strong>{venta.empleado_nombre}</strong><span>${venta.total.toFixed(2)} · {new Date(venta.created_at).toLocaleString('es-AR')}</span></div>
                {venta.conflictos.map((conflicto, index) => (
                  <div key={`${venta.id}-${index}`} className="conflict-item"><strong>{conflicto.producto_nombre}</strong><span>{conflicto.cantidad} u. · capturado ${Number(conflicto.precio_capturado).toFixed(2)} · vigente ${Number(conflicto.precio_vigente).toFixed(2)} · diferencia ${Number(conflicto.diferencia_unitaria).toFixed(2)}</span></div>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
