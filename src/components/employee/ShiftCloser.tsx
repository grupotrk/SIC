'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { type ExportCapability } from '@/lib/exportPolicy'
import { type Turno } from '@/types'

interface ShiftCloserProps {
  turnoActivo: Turno | null
  exportCapabilities: ExportCapability[]
  onClosed: () => void
}

export default function ShiftCloser({ turnoActivo, exportCapabilities, onClosed }: ShiftCloserProps) {
  const [efectivoDec, setEfectivoDec] = useState('')
  const [exportingArqueoPdf, setExportingArqueoPdf] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const hasExportCapability = exportCapabilities.some(c => c.key === 'arqueo_turno_personal')

  const exportarArqueoPdf = async (idTurno: string) => {
    setExportingArqueoPdf(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMensaje({ tipo: 'error', texto: 'Sesión expirada.' })
        return
      }

      const response = await fetch(`/api/exports/arqueo-turno-pdf?turnoId=${idTurno}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) {
        setMensaje({ tipo: 'error', texto: 'No se pudo exportar el arqueo PDF.' })
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arqueo-turno-${idTurno.substring(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setMensaje({ tipo: 'success', texto: 'PDF descargado correctamente.' })
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al exportar PDF.' })
    } finally {
      setExportingArqueoPdf(false)
    }
  }

  const cerrarTurno = async () => {
    if (!turnoActivo) {
      setMensaje({ tipo: 'error', texto: 'No hay turno activo.' })
      return
    }

    if (!efectivoDec) {
      setMensaje({ tipo: 'error', texto: 'Debes declarar el efectivo en caja para cerrar.' })
      return
    }

    if (!confirm('¿Seguro que querés cerrar el turno? Ya no vas a poder registrar ventas.')) {
      return
    }

    setLoading(true)
    setMensaje(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMensaje({ tipo: 'error', texto: 'Sesión expirada.' })
        setLoading(false)
        return
      }

      const response = await fetch('/api/shift/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          turno_id: turnoActivo.id,
          efectivo_declarado: parseFloat(efectivoDec),
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setMensaje({ tipo: 'error', texto: payload.error || 'Error al cerrar el turno' })
        setLoading(false)
        return
      }

      // El turno se cerró. Ofrecemos descargar el PDF.
      setMensaje({ tipo: 'success', texto: 'Turno cerrado correctamente. Descargando arqueo...' })
      setLoading(false)

      if (hasExportCapability) {
        await exportarArqueoPdf(turnoActivo.id)
      }
      
      // Esperamos un poquito para que vea el msj y el PDF, y volvemos a la pantalla de apertura.
      setTimeout(() => {
        onClosed()
      }, 3000)

    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red o servidor.' })
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-2 text-2xl font-bold text-slate-900 text-center">Cerrar Caja</h2>
        <p className="mb-6 text-sm text-slate-500 text-center">
          Contá el dinero físico de la caja y declará el monto total para finalizar el turno.
        </p>

        {mensaje && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${
              mensaje.tipo === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Total de efectivo contado ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={efectivoDec}
              onChange={(e) => setEfectivoDec(e.target.value)}
              placeholder="Ej: 45000"
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={cerrarTurno}
            disabled={loading || exportingArqueoPdf}
            className="w-full rounded-xl bg-red-600 p-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? 'Cerrando turno...' : 'Declarar Efectivo y Cerrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
