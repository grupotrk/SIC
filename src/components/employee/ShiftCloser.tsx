'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { type ExportCapability } from '@/lib/exportPolicy'
import { type Turno } from '@/types'

type Arqueo = {
  caja_inicial: number
  ventas_efectivo: number
  total_tarjeta: number
  total_transferencia: number
  total_billetera: number
  total_qr: number
  efectivo_esperado: number
  efectivo_declarado?: number
  diferencia_caja?: number
  total_general: number
  transacciones: number
}

interface ShiftCloserProps {
  turnoActivo: Turno | null
  exportCapabilities: ExportCapability[]
  onClosed: () => void
}

const money = (value: number | undefined) => `$${Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ShiftCloser({ turnoActivo, exportCapabilities, onClosed }: ShiftCloserProps) {
  const [efectivoDec, setEfectivoDec] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [preview, setPreview] = useState<Arqueo | null>(null)
  const [closedArqueo, setClosedArqueo] = useState<Arqueo | null>(null)
  const [exportingArqueoPdf, setExportingArqueoPdf] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const hasExportCapability = exportCapabilities.some(c => c.key === 'arqueo_turno_personal')
  const declarado = Number(efectivoDec)
  const diferenciaLive = useMemo(() => Number.isFinite(declarado) && preview ? declarado - preview.efectivo_esperado : null, [declarado, preview])

  useEffect(() => {
    if (!turnoActivo?.id) return
    let cancelled = false
    const load = async () => {
      setLoadingPreview(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const response = await fetch(`/api/shift/close?turno_id=${encodeURIComponent(turnoActivo.id)}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        const payload = await response.json() as { ok?: boolean; preview?: Arqueo; error?: string }
        if (!cancelled && response.ok && payload.preview) setPreview(payload.preview)
        else if (!cancelled && !response.ok) setMensaje({ tipo: 'error', texto: payload.error ?? 'No se pudo calcular el arqueo.' })
      } catch {
        if (!cancelled) setMensaje({ tipo: 'error', texto: 'No se pudo calcular el arqueo.' })
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [turnoActivo?.id])

  const exportarArqueoPdf = async (idTurno: string) => {
    setExportingArqueoPdf(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const response = await fetch(`/api/exports/arqueo-turno-pdf?turnoId=${idTurno}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arqueo-turno-${idTurno.substring(0, 8)}.pdf`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo exportar el arqueo PDF.' })
    } finally { setExportingArqueoPdf(false) }
  }

  const cerrarTurno = async () => {
    if (!turnoActivo || !preview) return
    if (!efectivoDec || !Number.isFinite(declarado) || declarado < 0) {
      setMensaje({ tipo: 'error', texto: 'Ingresá el efectivo contado en caja.' }); return
    }
    setLoading(true); setMensaje(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesión expirada.')
      const response = await fetch('/api/shift/close', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ turno_id: turnoActivo.id, efectivo_declarado: declarado, observaciones }),
      })
      const payload = await response.json() as { ok?: boolean; arqueo?: Arqueo; error?: string }
      if (!response.ok || !payload.arqueo) throw new Error(payload.error ?? 'No se pudo cerrar el turno.')
      setClosedArqueo(payload.arqueo)
      setMensaje({ tipo: 'success', texto: 'Turno cerrado correctamente.' })
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : 'Error de red o servidor.' })
    } finally { setLoading(false) }
  }

  const summaryRows = (arqueo: Arqueo) => [
    ['Caja inicial', money(arqueo.caja_inicial)],
    ['Ventas en efectivo', money(arqueo.ventas_efectivo)],
    ['Tarjeta', money(arqueo.total_tarjeta)],
    ['Transferencias', money(arqueo.total_transferencia)],
    ['Billeteras virtuales', money(arqueo.total_billetera)],
    ['QR', money(arqueo.total_qr)],
    ['Ventas totales', money(arqueo.total_general)],
  ]

  if (closedArqueo && turnoActivo) {
    const diff = closedArqueo.diferencia_caja ?? 0
    return (
      <div className="mx-auto max-w-2xl py-6">
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">✓</div><div><h2 className="text-xl font-bold text-slate-900">Turno cerrado</h2><p className="text-sm text-slate-500">Arqueo registrado correctamente.</p></div></div>
          <div className="grid gap-2 sm:grid-cols-2">{summaryRows(closedArqueo).map(([label, value]) => <div key={label} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-500">{label}</span><strong className="text-slate-800">{value}</strong></div>)}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">Efectivo esperado</div><div className="mt-1 text-lg font-bold">{money(closedArqueo.efectivo_esperado)}</div></div>
            <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">Efectivo contado</div><div className="mt-1 text-lg font-bold">{money(closedArqueo.efectivo_declarado)}</div></div>
            <div className={`rounded-xl border p-3 ${Math.abs(diff) < 0.005 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="text-xs text-slate-500">Diferencia</div><div className={`mt-1 text-lg font-bold ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{money(diff)}</div></div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">{hasExportCapability && <button onClick={() => exportarArqueoPdf(turnoActivo.id)} disabled={exportingArqueoPdf} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{exportingArqueoPdf ? 'Generando...' : 'Descargar arqueo PDF'}</button>}<button onClick={onClosed} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Finalizar</button></div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5"><h2 className="text-xl font-bold text-slate-900">Cerrar turno</h2><p className="mt-1 text-sm text-slate-500">Contá el efectivo físico. Los pagos electrónicos no forman parte del dinero esperado en caja.</p></div>
        {mensaje && <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{mensaje.texto}</div>}
        {loadingPreview || !preview ? <div className="py-8 text-center text-sm text-slate-500">Calculando arqueo...</div> : <>
          <div className="grid gap-2 sm:grid-cols-2">{summaryRows(preview).map(([label, value]) => <div key={label} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-500">{label}</span><strong>{value}</strong></div>)}</div>
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Efectivo esperado</div><div className="mt-1 text-2xl font-black text-sky-950">{money(preview.efectivo_esperado)}</div><div className="mt-1 text-xs text-sky-700">Caja inicial + ventas cobradas en efectivo.</div></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-semibold text-slate-700">Efectivo contado ($)</label><input autoFocus type="number" min="0" step="0.01" value={efectivoDec} onChange={e => setEfectivoDec(e.target.value)} placeholder="Ingresá lo que contaste" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base font-semibold outline-none focus:border-emerald-500" /></div><div className={`rounded-xl border p-3 ${diferenciaLive === null ? 'border-slate-200' : Math.abs(diferenciaLive) < 0.005 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="text-xs text-slate-500">Diferencia de caja</div><div className={`mt-1 text-xl font-bold ${diferenciaLive !== null && diferenciaLive < 0 ? 'text-red-600' : diferenciaLive !== null && diferenciaLive > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{diferenciaLive === null ? '—' : money(diferenciaLive)}</div></div></div>
          <div className="mt-4"><label className="mb-1 block text-sm font-semibold text-slate-700">Observaciones <span className="font-normal text-slate-400">(opcional)</span></label><textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} placeholder="Ej: faltante justificado, retiro de efectivo..." className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" /></div>
          <div className="mt-5 flex justify-end gap-2"><button onClick={onClosed} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Volver</button><button onClick={cerrarTurno} disabled={loading || !efectivoDec} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{loading ? 'Cerrando...' : 'Confirmar cierre'}</button></div>
        </>}
      </div>
    </div>
  )
}
