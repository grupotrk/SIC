import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#07111F] px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-[#0D1B2A] p-8 shadow-2xl">
        <img src="/sidea-logo.png" alt="SIDEA" className="mb-6 h-12 w-auto" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">404</p>
        <h1 className="mt-2 text-2xl font-bold">Página no encontrada</h1>
        <p className="mt-3 text-sm text-slate-300">La sección que buscás no existe o cambió de ubicación.</p>
        <Link href="/" className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
