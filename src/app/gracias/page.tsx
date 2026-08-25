import Image from 'next/image'

type GraciasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function pickParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export default async function GraciasPage({ searchParams }: GraciasPageProps) {
  const params = searchParams ? await searchParams : {}
  const status = pickParam(params.status || params.collection_status).toLowerCase()

  const isApproved = status === 'approved'
  const title = isApproved ? 'Pago acreditado correctamente' : 'Estamos procesando tu suscripción'
  const subtitle = isApproved
    ? 'Gracias por suscribirte a Trikode. Tu comercio está entrando en proceso de alta automática.'
    : 'Recibimos tu operación. Si Mercado Pago demora en confirmar, el alta continuará apenas se apruebe el pago.'

  const contactWhatsapp = process.env.CONTACT_WHATSAPP || ''

  return (
    <main
      className="min-h-screen px-4 py-12 text-white"
      style={{ background: 'linear-gradient(135deg, #15345f 0%, #0b1730 100%)' }}
    >
      <div className="mx-auto max-w-3xl">
        <section
          className="rounded-3xl p-8 md:p-12 text-center"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          }}
        >
          <Image
            src="/trikode-logo.png"
            alt="Trikode Ingenieria"
            width={160}
            height={56}
            className="h-14 w-auto mx-auto mb-2 object-contain"
            priority
          />
          <div className="mb-6">
            <span
              className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                background: isApproved ? 'rgba(51,211,231,0.16)' : 'rgba(21,52,95,0.14)',
                border: isApproved ? '1px solid rgba(51,211,231,0.34)' : '1px solid rgba(21,52,95,0.32)',
                color: isApproved ? '#33d3e7' : '#b8f3fb',
              }}
            >
              {isApproved ? 'Pago aprobado' : 'Pago en revisión'}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-4" style={{ color: '#33d3e7' }}>
            {title}
          </h1>
          <p className="text-lg text-slate-200 max-w-2xl mx-auto mb-8">{subtitle}</p>

          <div
            className="rounded-2xl p-5 text-left mb-8"
            style={{ background: 'rgba(51,211,231,0.08)', border: '1px solid rgba(51,211,231,0.28)' }}
          >
            <h2 className="text-xl font-bold mb-4">Qué sigue ahora</h2>
            <div className="space-y-3 text-sm text-slate-200">
              <p>1. Confirmamos el pago y activamos tu comercio automáticamente.</p>
              <p>2. Te enviamos un email de agradecimiento por la suscripción.</p>
              <p>3. El dueño recibe el correo de activación para definir su propia contraseña.</p>
              <p>4. Luego vas a poder ingresar al SIC desde el login del sistema.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/login"
              className="rounded-xl px-5 py-3 font-bold"
              style={{
                background: 'linear-gradient(45deg, #33d3e7, #15345f)',
                color: '#fff',
                boxShadow: '0 8px 24px rgba(51,211,231,0.3)',
              }}
            >
              Ir al login del SIC
            </a>
            {contactWhatsapp && (
              <a
                href={`https://wa.me/${contactWhatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl px-5 py-3 font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                }}
              >
                Hablar por WhatsApp
              </a>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}