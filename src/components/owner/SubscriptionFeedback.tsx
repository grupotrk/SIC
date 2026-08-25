'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { type SubscriptionComputed } from '@/lib/subscriptionLifecycle'

const CANCEL_REASONS = [
  'No lo uso lo suficiente',
  'Me resulta complejo',
  'Me faltan funcionalidades',
  'Tuve problemas técnicos',
  'Cierro el negocio',
  'Otro motivo',
]

interface Props {
  subscription: SubscriptionComputed | null
  onSubscriptionChanged?: () => void
}

function daysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate + 'T00:00:00Z')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function SubscriptionFeedback({ subscription, onSubscriptionChanged }: Props) {
  const [renovandoSuscripcion, setRenovandoSuscripcion] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const [suggestionAllowContact, setSuggestionAllowContact] = useState(true)
  const [sendingSuggestion, setSendingSuggestion] = useState(false)
  const [cancelReasons, setCancelReasons] = useState<string[]>([])
  const [cancelDetail, setCancelDetail] = useState('')
  const [cancelAllowContact, setCancelAllowContact] = useState(true)
  const [sendingCancel, setSendingCancel] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)

  // Muestra el botón de renovación cuando: está en gracia, solo descarga,
  // o activo con 7 días o menos hasta el vencimiento.
  const daysLeft = daysUntilDue(subscription?.dueDate ?? null)
  const showRenewal =
    subscription != null &&
    (subscription.status === 'EN_GRACIA' ||
      subscription.status === 'SOLO_DESCARGA' ||
      (subscription.status === 'ACTIVO' && daysLeft !== null && daysLeft <= 7))

  const renewalMessage = () => {
    if (!subscription) return ''
    if (subscription.status === 'EN_GRACIA') {
      if (subscription.isTrial)
        return `Tu período de prueba gratuito venció hace ${subscription.daysOverdue} ${subscription.daysOverdue === 1 ? 'día' : 'días'}. Activá tu suscripción para seguir usando el SIC.`
      return `Tu suscripción venció hace ${subscription.daysOverdue} ${subscription.daysOverdue === 1 ? 'día' : 'días'}. Renová ahora para mantener el acceso completo.`
    }
    if (subscription.status === 'SOLO_DESCARGA')
      return `Tu cuenta está en modo solo descarga. Te quedan ${subscription.downloadDaysRemaining} días para exportar tus datos. Renová para recuperar el acceso completo.`
    return `Tu suscripción vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}. Podés renovar anticipadamente sin perder días.`
  }

  const renovarSuscripcion = async () => {
    setRenovandoSuscripcion(true)
    setMensaje(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMensaje({ tipo: 'error', texto: 'Sesión expirada. Iniciá sesión nuevamente.' })
        return
      }

      const response = await fetch('/api/payments/create-renewal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const payload = (await response.json().catch(() => null)) as {
        ok: boolean
        checkout_url?: string
        error?: string
      } | null

      if (!response.ok || !payload?.ok || !payload.checkout_url) {
        setMensaje({
          tipo: 'error',
          texto: 'No se pudo generar el link de pago. Intentá de nuevo en unos segundos.',
        })
        return
      }

      // Abre el checkout de MercadoPago en la misma pestaña
      window.location.href = payload.checkout_url
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al conectar con el servicio de pagos.' })
    } finally {
      setRenovandoSuscripcion(false)
    }
  }

  const enviarSugerencia = async () => {
    const texto = suggestionText.trim()
    if (!texto) {
      setMensaje({ tipo: 'error', texto: 'Escribe una sugerencia antes de enviar.' })
      return
    }

    setSendingSuggestion(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMensaje({ tipo: 'error', texto: 'Sesión expirada. Iniciá sesión nuevamente.' })
        return
      }

      const response = await fetch('/api/account/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          category: 'OPINIONES_SIC',
          message: texto,
          allow_contact: suggestionAllowContact,
        }),
      })

      if (!response.ok) {
        setMensaje({ tipo: 'error', texto: 'No se pudo enviar la sugerencia.' })
        return
      }

      setSuggestionText('')
      setMensaje({ tipo: 'success', texto: 'Gracias. Tu sugerencia fue registrada.' })
      setTimeout(() => setMensaje(null), 3000)
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error enviando sugerencia.' })
    } finally {
      setSendingSuggestion(false)
    }
  }

  const solicitarBaja = async () => {
    if (cancelReasons.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Selecciona al menos un motivo para la baja.' })
      return
    }

    setSendingCancel(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMensaje({ tipo: 'error', texto: 'Sesión expirada. Iniciá sesión nuevamente.' })
        return
      }

      const response = await fetch('/api/account/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reasons: cancelReasons,
          details: cancelDetail,
          allow_contact: cancelAllowContact,
        }),
      })

      if (!response.ok) {
        setMensaje({ tipo: 'error', texto: 'No se pudo solicitar la baja.' })
        return
      }

      setMensaje({
        tipo: 'success',
        texto: 'Baja voluntaria registrada. Mantendrás acceso de descarga según política.',
      })
      setTimeout(() => setMensaje(null), 4000)
      if (onSubscriptionChanged) {
        setTimeout(() => onSubscriptionChanged(), 1000)
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al solicitar la baja.' })
    } finally {
      setSendingCancel(false)
    }
  }

  return (
    <>
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

      {/* Período de prueba activo */}
      {subscription?.isTrial && subscription.status === 'ACTIVO' && (
        <div className="mb-6 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎁</span>
                <h3 className="text-base font-semibold text-violet-900">Período de prueba gratuito</h3>
              </div>
              <p className="text-sm text-violet-700">
                Tu prueba vence el{' '}
                <strong>
                  {subscription.dueDate
                    ? new Date(subscription.dueDate + 'T00:00:00Z').toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </strong>
                . Cuando quieras continuar, activá tu suscripción mensual.
              </p>
            </div>
            <button
              id="btn-activar-suscripcion"
              onClick={renovarSuscripcion}
              disabled={renovandoSuscripcion}
              className="shrink-0 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              {renovandoSuscripcion ? 'Generando link...' : 'Activar suscripción →'}
            </button>
          </div>
        </div>
      )}

      {/* Renovación — visible cuando venció o está por vencer */}
      {showRenewal && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-blue-900">{subscription?.isTrial ? 'Activar suscripción' : 'Renovar suscripción'}</h3>
              <p className="mt-1 text-sm text-blue-700">{renewalMessage()}</p>
            </div>
            <button
              id="btn-renovar-suscripcion"
              onClick={renovarSuscripcion}
              disabled={renovandoSuscripcion}
              className="shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {renovandoSuscripcion ? 'Generando link...' : 'Pagar suscripción →'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-lg font-semibold mb-2">Opiniones y sugerencias</h3>
          <p className="text-sm text-slate-600 mb-3">
            Queremos mejorar el SIC en base a lo que piden los comercios activos.
          </p>
          <textarea
            rows={4}
            value={suggestionText}
            onChange={(e) => setSuggestionText(e.target.value)}
            className="w-full rounded border border-slate-300 p-2"
            placeholder="Contanos qué cambio te gustaría ver en Trikode SIC"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={suggestionAllowContact}
              onChange={(e) => setSuggestionAllowContact(e.target.checked)}
            />
            Pueden contactarme para profundizar esta sugerencia.
          </label>
          <button
            onClick={enviarSugerencia}
            disabled={sendingSuggestion || subscription?.accessMode !== 'FULL'}
            className="mt-3 w-full rounded bg-emerald-600 px-3 py-2 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {sendingSuggestion ? 'Enviando...' : 'Enviar sugerencia'}
          </button>
        </div>

        <div className="rounded border border-rose-200 bg-rose-50 p-4">
          <h3 className="text-lg font-semibold text-rose-800 mb-2">Botón de arrepentimiento</h3>
          <p className="text-sm text-rose-700 mb-3">
            Si querés darte de baja, seleccioná motivos para ayudarnos a mejorar.
          </p>

          <div className="space-y-2 mb-3">
            {CANCEL_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-2 text-sm text-rose-800">
                <input
                  type="checkbox"
                  checked={cancelReasons.includes(reason)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCancelReasons((prev) => [...prev, reason])
                    } else {
                      setCancelReasons((prev) => prev.filter((item) => item !== reason))
                    }
                  }}
                />
                {reason}
              </label>
            ))}
          </div>

          <textarea
            rows={3}
            value={cancelDetail}
            onChange={(e) => setCancelDetail(e.target.value)}
            className="w-full rounded border border-rose-300 p-2 text-sm"
            placeholder="¿Algo más que quieras decirnos? (Opcional)"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-rose-800">
            <input
              type="checkbox"
              checked={cancelAllowContact}
              onChange={(e) => setCancelAllowContact(e.target.checked)}
            />
            Pueden contactarme para consultar.
          </label>
          <button
            onClick={solicitarBaja}
            disabled={sendingCancel || cancelReasons.length === 0}
            className="mt-3 w-full rounded bg-rose-700 px-3 py-2 text-white font-semibold hover:bg-rose-800 disabled:opacity-60"
          >
            {sendingCancel ? 'Procesando...' : 'Solicitar baja voluntaria'}
          </button>
        </div>
      </div>
    </>
  )
}
