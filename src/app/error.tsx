'use client'

import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[SIDEA SIC] Error de aplicación', error)
  }, [error])

  return (
    <main className="min-h-screen bg-[#07111F] px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-[#0D1B2A] p-8 shadow-2xl">
        <img src="/sidea-logo.png" alt="SIDEA" className="mb-6 h-12 w-auto" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">SIC</p>
        <h1 className="mt-2 text-2xl font-bold">Algo no salió como esperábamos</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Tus datos no se borraron por esta pantalla. Podés intentar nuevamente y, si el problema continúa, comunicarte con soporte.
        </p>
        <button onClick={reset} className="mt-6 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
          Intentar nuevamente
        </button>
      </div>
    </main>
  )
}
