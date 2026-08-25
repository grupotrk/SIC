const TERMS_VERSION = 'v1.1'
const EFFECTIVE_DATE = '19/03/2026'

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 p-6 md:p-8">
        <h1 className="mb-2 text-3xl font-black">Politica de Privacidad - Trikode Ingenieria</h1>
        <p className="mb-6 text-sm text-slate-300">
          Version {TERMS_VERSION} | Vigencia desde {EFFECTIVE_DATE}
        </p>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">1. Datos que recolectamos</h2>
          <p>
            Recolectamos datos de alta comercial (nombre de comercio, rubro, contacto y email), datos operativos del
            sistema (productos, ventas, usuarios) y metadatos tecnicos necesarios para seguridad y auditoria.
          </p>
        </section>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">2. Finalidad del tratamiento</h2>
          <p>
            Usamos los datos para prestar el servicio de gestion interna, procesar altas y pagos, brindar soporte,
            prevenir fraude y cumplir obligaciones contractuales y legales.
          </p>
          <p>
            SIC es una herramienta de gestion interna. No realiza facturacion electronica, no presenta declaraciones,
            no informa automaticamente operaciones a ARCA/AFIP ni reemplaza los sistemas fiscales o contables que el
            comercio deba utilizar conforme a la normativa vigente.
          </p>
          <p>
            La informacion cargada en SIC se administra para uso operativo privado del comercio. El cumplimiento de las
            obligaciones tributarias, registrales y de facturacion frente a organismos estatales sigue siendo
            responsabilidad exclusiva del usuario.
          </p>
        </section>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">3. Conservacion y depuracion</h2>
          <p>
            Mientras la suscripcion este activa o en periodos de gracia/descarga, los datos operativos se conservan
            para uso del comercio.
          </p>
          <p>
            Si no hay reactivacion dentro de los plazos definidos en los Terminos de Servicio, Trikode podra eliminar
            de forma permanente la informacion operativa del tenant.
          </p>
          <p>
            Podemos conservar un minimo de registros administrativos o de transaccion para auditoria, conciliacion de
            pagos y cumplimiento normativo.
          </p>
        </section>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">4. Seguridad</h2>
          <p>
            Aplicamos medidas tecnicas razonables para proteger la informacion, incluyendo control de acceso, cifrado
            en transito y segregacion por tenant.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">5. Aceptacion y versionado</h2>
          <p>
            Al registrarse, el usuario acepta esta Politica de Privacidad y los Terminos de Servicio. Guardamos
            evidencia de aceptacion (fecha, version e IP) para trazabilidad legal.
          </p>
        </section>
      </div>
    </main>
  )
}
