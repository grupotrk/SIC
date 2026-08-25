'use client'

import { useState } from 'react'

type LeadPayload = {
  nombre_comercio: string
  rubro: string
  whatsapp: string
  email: string
  mensaje: string
  referral_code: string
  accepted_terms: boolean
}

type ApiResult = {
  ok: boolean
  mercado_pago_link?: string
  error?: string
}

const RUBROS = [
  'Kiosco',
  'Rotisería',
  'Rotisería/Carrito',
  'Ferretería',
  'Carnicería',
  'Carnicería/Verdulería',
  'Tienda de Mascotas',
  'Librería',
]

export default function DemoPage() {
  const [form, setForm] = useState<LeadPayload>({
    nombre_comercio: '',
    rubro: '',
    whatsapp: '',
    email: '',
    mensaje: '',
    referral_code: '',
    accepted_terms: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = (field: keyof LeadPayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.accepted_terms) {
      setError('Debes aceptar los Terminos y la Politica de Privacidad para continuar.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/register-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = (await res.json().catch(() => null)) as ApiResult | null
      if (!res.ok || !data?.ok || !data.mercado_pago_link) {
        setError('No pudimos iniciar el alta. Intentá nuevamente en unos minutos.')
        return
      }

      window.location.href = data.mercado_pago_link
    } catch {
      setError('Error de conexión. Verificá internet e intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-slate-800 p-8 mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-3">Trikode Ingenieria</p>
          <h1 className="text-3xl md:text-4xl font-black mb-3">Demo + Activacion SIC</h1>
          <p className="text-slate-300 max-w-3xl">
            Completá tus datos, generamos el alta comercial, pagás la suscripción y el sistema activa tu comercio automáticamente.
          </p>
          <div className="mt-4 text-sm text-emerald-300">Plan Trikode Completo: $40.000 ARS/mes</div>
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <strong>SIC significa Sistema Interno de Control.</strong> Te ayuda a ordenar ventas, stock y caja para tener panorama claro del negocio,
            pero no reemplaza la facturación electrónica ni las obligaciones fiscales del comercio ante ARCA/AFIP.
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-bold mb-4">Comenzar alta</h2>
            <form className="space-y-4" onSubmit={submit}>
              {error && <div className="rounded border border-red-700 bg-red-950/50 p-3 text-sm text-red-200">{error}</div>}

              <div>
                <label className="block text-sm mb-1">Nombre del comercio</label>
                <input
                  required
                  className="w-full rounded bg-slate-800 border border-slate-700 p-2"
                  value={form.nombre_comercio}
                  onChange={(e) => updateField('nombre_comercio', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Rubro</label>
                <select
                  required
                  className="w-full rounded bg-slate-800 border border-slate-700 p-2"
                  value={form.rubro}
                  onChange={(e) => updateField('rubro', e.target.value)}
                >
                  <option value="">Seleccionar rubro</option>
                  {RUBROS.map((rubro) => (
                    <option key={rubro} value={rubro}>
                      {rubro}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">WhatsApp</label>
                <input
                  required
                  className="w-full rounded bg-slate-800 border border-slate-700 p-2"
                  value={form.whatsapp}
                  onChange={(e) => updateField('whatsapp', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full rounded bg-slate-800 border border-slate-700 p-2"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Codigo de referido (opcional)</label>
                <input
                  className="w-full rounded bg-slate-800 border border-slate-700 p-2 uppercase"
                  value={form.referral_code}
                  onChange={(e) => updateField('referral_code', e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Mensaje (opcional)</label>
                <textarea
                  rows={3}
                  className="w-full rounded bg-slate-800 border border-slate-700 p-2"
                  value={form.mensaje}
                  onChange={(e) => updateField('mensaje', e.target.value)}
                />
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3 text-sm text-slate-200">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.accepted_terms}
                    onChange={(e) => setForm((prev) => ({ ...prev, accepted_terms: e.target.checked }))}
                  />
                  <span>
                    Acepto los{' '}
                    <a href="/terminos" target="_blank" rel="noreferrer" className="underline text-emerald-300">
                      Terminos de Servicio
                    </a>{' '}
                    y la{' '}
                    <a href="/privacidad" target="_blank" rel="noreferrer" className="underline text-emerald-300">
                      Politica de Privacidad
                    </a>
                    .
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-emerald-500 px-4 py-2 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? 'Generando pago...' : 'Continuar a pago'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-bold mb-4">Como funciona</h2>
            <ol className="space-y-3 text-sm text-slate-300 list-decimal list-inside">
              <li>Completás el formulario comercial y aceptás los Terminos/Privacidad.</li>
              <li>Te enviamos a Mercado Pago para abonar la suscripción.</li>
              <li>Al aprobarse el pago, activamos el comercio automáticamente.</li>
              <li>Recibís email para acceso al SIC con tu usuario.</li>
            </ol>

            <div className="mt-6 rounded-xl border border-sky-700/50 bg-sky-950/40 p-4 text-sm text-sky-100">
              Si ya sos cliente, ingresá directo desde
              <a href="/login" className="ml-1 underline font-semibold">/login</a>.
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
