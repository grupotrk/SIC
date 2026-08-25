const TERMS_VERSION = 'v1.0'
const EFFECTIVE_DATE = '15/03/2026'

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 p-6 md:p-8">
        <h1 className="mb-2 text-3xl font-black">Terminos de Servicio - Trikode Ingenieria</h1>
        <p className="mb-6 text-sm text-slate-300">
          Version {TERMS_VERSION} | Vigencia desde {EFFECTIVE_DATE}
        </p>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">1. Objeto del servicio</h2>
          <p>
            Trikode Ingenieria provee un sistema de gestion interna para comercios (stock, ventas, usuarios,
            reportes y cierres). No es un sistema de facturacion fiscal ni reemplaza obligaciones tributarias ante
            organismos estatales.
          </p>
        </section>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">2. Suscripcion, vencimiento y gracia</h2>
          <p>La suscripcion es mensual y habilita el uso operativo completo del sistema durante su vigencia.</p>
          <p>
            Si la suscripcion vence, el comercio entra en periodo de gracia por 7 (siete) dias corridos. Durante ese
            plazo el servicio permanece disponible y se mostraran avisos de regularizacion.
          </p>
          <p>
            Vencido el periodo de gracia, la cuenta pasa a modo de solo descarga por un periodo limitado definido por
            Trikode, para permitir la exportacion de informacion comercial.
          </p>
          <p>
            Finalizado ese periodo sin reactivacion, Trikode podra depurar de forma definitiva la informacion del
            tenant, manteniendo solo los registros minimos necesarios para auditoria comercial y cumplimiento legal.
          </p>
        </section>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">3. Responsabilidad del usuario</h2>
          <p>
            El usuario es responsable de la veracidad de los datos cargados, de sus obligaciones fiscales y de operar
            con sistemas habilitados para facturacion cuando corresponda.
          </p>
          <p>
            Trikode no asume responsabilidad por multas, sanciones o incumplimientos originados por uso indebido del
            sistema o por el incumplimiento normativo del usuario.
          </p>
        </section>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">4. Disponibilidad y cambios</h2>
          <p>
            Trikode podra introducir mejoras, cambios funcionales y ajustes de seguridad. Tambien podra actualizar
            estos terminos, informando la nueva version en este mismo documento.
          </p>
        </section>

        <section className="mb-6 space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">5. Propiedad intelectual y uso permitido</h2>
          <p>
            El Sistema Interno de Control (SIC), su codigo, arquitectura, diseno, contenidos y funcionalidades son
            propiedad exclusiva de Trikode Ingenieria y se encuentran protegidos por las normas de propiedad
            intelectual aplicables.
          </p>
          <p>
            Queda expresamente prohibida la ingenieria inversa, descompilacion, desmontaje, copia no autorizada,
            reproduccion total o parcial, modificacion, distribucion o creacion de obras derivadas del SIC sin
            autorizacion previa y por escrito de Trikode Ingenieria.
          </p>
          <p>
            El uso del servicio otorga al cliente una licencia de uso limitada, no exclusiva, no transferible y
            revocable, sujeta al cumplimiento de estos Terminos.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-200">
          <h2 className="text-xl font-bold text-emerald-300">6. Aceptacion</h2>
          <p>
            Al registrarse y continuar al pago, el usuario declara haber leido y aceptado estos Terminos de Servicio
            junto con la Politica de Privacidad vigente.
          </p>
        </section>
      </div>
    </main>
  )
}
