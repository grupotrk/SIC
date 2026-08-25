'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { type UserRole, type Turno } from '@/types'

interface ShiftOpenerProps {
  userRole: UserRole | null
  onShiftOpened: (turno: Turno) => void
}

export default function ShiftOpener({ userRole, onShiftOpened }: ShiftOpenerProps) {
  const [cajaInicial, setCajaInicial] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)

  const abrirTurno = async () => {
    if (!userRole) {
      setMensaje({ tipo: 'error', texto: 'No se pudo identificar el usuario.' })
      return
    }

    if (!cajaInicial) {
      setMensaje({ tipo: 'error', texto: 'Debes ingresar un monto inicial.' })
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

      const response = await fetch('/api/shift/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          comercio_usuario_id: userRole.id,
          tenant_id: userRole.tenantId,
          caja_inicial: parseFloat(cajaInicial),
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setMensaje({ tipo: 'error', texto: payload.error || 'Error al abrir el turno' })
        setLoading(false)
        return
      }

      onShiftOpened(payload.turno)
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red o de servidor.' })
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-2 text-2xl font-bold text-slate-900 text-center">Abrir Caja</h2>
        <p className="mb-6 text-sm text-slate-500 text-center">
          Ingresá el monto de efectivo inicial con el que arrancás el turno.
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
            <label className="mb-1 block text-sm font-semibold text-slate-700">Monto inicial en caja ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cajaInicial}
              onChange={(e) => setCajaInicial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') abrirTurno()
              }}
              placeholder="Ej: 15000"
              className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={abrirTurno}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 p-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? 'Abriendo turno...' : 'Confirmar y Abrir'}
          </button>
        </div>
      </div>
    </div>
  )
}
