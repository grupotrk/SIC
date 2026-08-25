'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AddEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface AddEmployeeFormData {
  empleadoNombre: string
  usuarioPropuesto: string
  contraseña: string
}

interface SuccessResponse {
  success: true
  usuarioAsignado: string
  email: string
  comercioUsuarioId: string
  mensaje?: string
}

interface ErrorResponse {
  success: false
  error: string
  sugerencias?: string[]
}

export default function AddEmployeeModal({
  isOpen,
  onClose,
  onSuccess,
}: AddEmployeeModalProps) {
  const [formData, setFormData] = useState<AddEmployeeFormData>({
    empleadoNombre: '',
    usuarioPropuesto: '',
    contraseña: '',
  })
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(
    null
  )
  const [sugerencias, setSugerencias] = useState<string[]>([])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setMensaje({ tipo: 'error', texto: 'No hay sesión activa' })
      return
    }
    const sessionToken = session.access_token

    setLoading(true)
    setMensaje(null)
    setSugerencias([])

    try {
      if (!formData.empleadoNombre.trim()) {
        setMensaje({ tipo: 'error', texto: 'El nombre del empleado es requerido' })
        setLoading(false)
        return
      }

      if (!formData.usuarioPropuesto.trim()) {
        setMensaje({ tipo: 'error', texto: 'El usuario es requerido' })
        setLoading(false)
        return
      }

      if (!/^[a-zA-Z]{3,30}$/.test(formData.usuarioPropuesto)) {
        setMensaje({
          tipo: 'error',
          texto: 'Usuario debe contener solo letras (3-30 caracteres)',
        })
        setLoading(false)
        return
      }

      if (formData.contraseña.length < 6) {
        setMensaje({ tipo: 'error', texto: 'La contraseña debe tener al menos 6 caracteres' })
        setLoading(false)
        return
      }

      const response = await fetch('/api/owner/add-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(formData),
      })

      const data = (await response.json()) as SuccessResponse | ErrorResponse

      if (!response.ok || !data.success) {
        const errorData = data as ErrorResponse
        if (errorData.sugerencias && errorData.sugerencias.length > 0) {
          setSugerencias(errorData.sugerencias)
          setMensaje({
            tipo: 'error',
            texto: `El usuario "${formData.usuarioPropuesto}" ya existe. Ver sugerencias abajo.`,
          })
        } else {
          setMensaje({
            tipo: 'error',
            texto:
              errorData.error === 'invalid_username_format'
                ? 'Usuario inválido (solo letras, 3-30 caracteres)'
                : errorData.error === 'invalid_password'
                  ? 'Contraseña muy corta (mín 6 caracteres)'
                  : 'Error al crear empleado',
          })
        }
        setLoading(false)
        return
      }

      const successData = data as SuccessResponse
      setMensaje({
        tipo: 'success',
        texto: `Empleado "${successData.usuarioAsignado}" creado exitosamente`,
      })

      // Limpiar formulario
      setFormData({
        empleadoNombre: '',
        usuarioPropuesto: '',
        contraseña: '',
      })

      // Callback
      if (onSuccess) {
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      } else {
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (error) {
      console.error('Error:', error)
      setMensaje({
        tipo: 'error',
        texto: 'Error al crear empleado. Intenta nuevamente.',
      })
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = (suggestion: string) => {
    setFormData((prev) => ({
      ...prev,
      usuarioPropuesto: suggestion,
    }))
    setSugerencias([])
    setMensaje(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full border border-emerald-600/30">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-emerald-400">Agregar Empleado</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300"
            title="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre del Empleado
            </label>
            <input
              type="text"
              name="empleadoNombre"
              value={formData.empleadoNombre}
              onChange={handleChange}
              placeholder="Juan Pérez"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Usuario (solo letras, 3-30 caracteres)
            </label>
            <input
              type="text"
              name="usuarioPropuesto"
              value={formData.usuarioPropuesto}
              onChange={handleChange}
              placeholder="juan"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contraseña (mín 6 caracteres)
            </label>
            <input
              type="password"
              name="contraseña"
              value={formData.contraseña}
              onChange={handleChange}
              placeholder="••••••"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50"
              disabled={loading}
            />
          </div>

          {mensaje && (
            <div
              className={`p-3 rounded text-sm ${
                mensaje.tipo === 'success'
                  ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-600/50'
                  : 'bg-red-900/30 text-red-300 border border-red-700/50'
              }`}
            >
              {mensaje.texto}
            </div>
          )}

          {sugerencias.length > 0 && (
            <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded">
              <p className="text-sm text-blue-300 mb-2">Usuarios sugeridos disponibles:</p>
              <div className="space-y-1">
                {sugerencias.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => applySuggestion(sug)}
                    className="block w-full text-left px-2 py-1 text-sm bg-blue-800/50 hover:bg-blue-700/50 text-blue-200 rounded transition"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded hover:bg-gray-800 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
