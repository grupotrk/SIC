'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AddEmployeeModal from '@/components/AddEmployeeModal'

interface EmpleadoRegistro {
  id: string
  nombre: string
  email: string
  activo: boolean
  metadata: Record<string, unknown> | null
}

export default function EmployeesManager() {
  const [listaEmpleados, setListaEmpleados] = useState<EmpleadoRegistro[]>([])
  const [deletingEmployee, setDeletingEmployee] = useState<string | null>(null)
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)

  useEffect(() => {
    loadListaEmpleados()
  }, [])

  const loadListaEmpleados = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/owner/list-employees', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const payload = (await res.json()) as { success: boolean; employees?: EmpleadoRegistro[] }
      if (payload.success && payload.employees) {
        setListaEmpleados(payload.employees)
      }
    } catch {
      // No bloquea
    }
  }

  const eliminarEmpleado = async (empleadoId: string) => {
    if (!confirm('¿Desactivar este empleado?')) return
    setDeletingEmployee(empleadoId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sin sesión')
      const res = await fetch(`/api/owner/list-employees?id=${empleadoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Error al desactivar')
      setMensaje({ tipo: 'success', texto: 'Empleado desactivado.' })
      setTimeout(() => setMensaje(null), 3000)
      loadListaEmpleados()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo desactivar el empleado.' })
    } finally {
      setDeletingEmployee(null)
    }
  }

  const togglePermiso = async (emp: EmpleadoRegistro, permiso: string, valorActual: boolean) => {
    const nuevoValor = !valorActual
    // Actualización optimista
    setListaEmpleados((prev) =>
      prev.map((e) =>
        e.id === emp.id ? { ...e, metadata: { ...(e.metadata ?? {}), [permiso]: nuevoValor } } : e
      )
    )
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch(
      `/api/owner/list-employees?id=${emp.id}&permiso=${permiso}&valor=${nuevoValor}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    )
    if (!res.ok) {
      // Revertir si falla
      setListaEmpleados((prev) =>
        prev.map((e) =>
          e.id === emp.id ? { ...e, metadata: { ...(e.metadata ?? {}), [permiso]: valorActual } } : e
        )
      )
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el permiso.' })
    }
  }

  return (
    <div className="mb-6">
      {mensaje && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            mensaje.tipo === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-slate-900">Empleados registrados</h2>
        <button
          onClick={() => setShowAddEmployeeModal(true)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
        >
          + Agregar
        </button>
      </div>

      {listaEmpleados.length === 0 ? (
        <p className="text-gray-500 text-sm">No hay empleados registrados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Nombre</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Usuario</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Estado</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700">Añadir stock</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700">Modificar precios</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {listaEmpleados.map((emp) => {
                const puedeStock = Boolean(emp.metadata?.puede_agregar_stock)
                const puedePrecios = Boolean(emp.metadata?.puede_modificar_precios)

                return (
                  <tr key={emp.id} className={!emp.activo ? 'opacity-50' : ''}>
                    <td className="px-4 py-2 font-medium text-slate-900">{emp.nombre}</td>
                    <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                      {(emp.metadata?.login_username as string) || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          emp.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => togglePermiso(emp, 'puede_agregar_stock', puedeStock)}
                        disabled={!emp.activo}
                        className={`rounded-full px-3 py-0.5 text-xs font-semibold transition ${
                          puedeStock
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        } disabled:cursor-not-allowed`}
                      >
                        {puedeStock ? 'Sí' : 'No'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => togglePermiso(emp, 'puede_modificar_precios', puedePrecios)}
                        disabled={!emp.activo}
                        className={`rounded-full px-3 py-0.5 text-xs font-semibold transition ${
                          puedePrecios
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        } disabled:cursor-not-allowed`}
                      >
                        {puedePrecios ? 'Sí' : 'No'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {emp.activo && (
                        <button
                          onClick={() => eliminarEmpleado(emp.id)}
                          disabled={deletingEmployee === emp.id}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-50"
                        >
                          {deletingEmployee === emp.id ? 'Desactivando...' : 'Desactivar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddEmployeeModal
        isOpen={showAddEmployeeModal}
        onClose={() => {
          setShowAddEmployeeModal(false)
          loadListaEmpleados()
        }}
      />
    </div>
  )
}
