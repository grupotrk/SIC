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
        <div className="subscription-notice subscription-notice--trial mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="subscription-notice-copy">
              <span className="subscription-eyebrow">PRUEBA GRATUITA</span>
              <h3>Período de prueba activo</h3>
              <p>
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
              className="subscription-primary-button shrink-0"
            >
              {renovandoSuscripcion ? 'Generando link...' : 'Activar suscripción →'}
            </button>
          </div>
        </div>
      )}

      {/* Renovación — visible cuando venció o está por vencer */}
      {showRenewal && (
        <div className="subscription-notice mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="subscription-notice-copy">
              <span className="subscription-eyebrow">SUSCRIPCIÓN</span>
              <h3>{subscription?.isTrial ? 'Activar suscripción' : 'Renovar suscripción'}</h3>
              <p>{renewalMessage()}</p>
            </div>
            <button
              id="btn-renovar-suscripcion"
              onClick={renovarSuscripcion}
              disabled={renovandoSuscripcion}
              className="subscription-primary-button shrink-0"
            >
              {renovandoSuscripcion ? 'Generando link...' : 'Pagar suscripción →'}
            </button>
          </div>
        </div>
      )}

      <div className="subscription-feedback-grid mt-6">
        <div className="subscription-panel">
          <div className="subscription-panel-heading">
            <span className="subscription-eyebrow">FEEDBACK</span>
            <h3>Opiniones y sugerencias</h3>
          </div>
          <p className="subscription-panel-description">
            Queremos mejorar el SIC en base a lo que piden los comercios activos.
          </p>
          <textarea
            rows={4}
            value={suggestionText}
            onChange={(e) => setSuggestionText(e.target.value)}
            className="subscription-textarea"
            placeholder="Contanos qué cambio te gustaría ver en SIDEA SIC"
          />
          <label className="subscription-check-label">
            <input
              type="checkbox"
              checked={suggestionAllowContact}
              onChange={(e) => setSuggestionAllowContact(e.target.checked)}
            />
            <span>Pueden contactarme para profundizar esta sugerencia.</span>
          </label>
          <button
            onClick={enviarSugerencia}
            disabled={sendingSuggestion || subscription?.accessMode !== 'FULL'}
            className="subscription-secondary-button"
          >
            {sendingSuggestion ? 'Enviando...' : 'Enviar sugerencia'}
          </button>
        </div>

        <div className="subscription-panel subscription-panel--danger">
          <div className="subscription-panel-heading">
            <span className="subscription-eyebrow subscription-eyebrow--danger">CANCELACIÓN</span>
            <h3>Botón de arrepentimiento</h3>
          </div>
          <p className="subscription-panel-description">
            Si querés darte de baja, seleccioná motivos para ayudarnos a mejorar.
          </p>

          <div className="subscription-reasons">
            {CANCEL_REASONS.map((reason) => (
              <label key={reason} className="subscription-check-label">
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
                <span>{reason}</span>
              </label>
            ))}
          </div>

          <textarea
            rows={3}
            value={cancelDetail}
            onChange={(e) => setCancelDetail(e.target.value)}
            className="subscription-textarea"
            placeholder="¿Algo más que quieras decirnos? (Opcional)"
          />
          <label className="subscription-check-label">
            <input
              type="checkbox"
              checked={cancelAllowContact}
              onChange={(e) => setCancelAllowContact(e.target.checked)}
            />
            <span>Pueden contactarme para consultar.</span>
          </label>
          <button
            onClick={solicitarBaja}
            disabled={sendingCancel || cancelReasons.length === 0}
            className="subscription-danger-button"
          >
            {sendingCancel ? 'Procesando...' : 'Solicitar baja voluntaria'}
          </button>
        </div>
      </div>
    </>
  )
}
