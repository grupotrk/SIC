import type { Metadata } from 'next'
import RootProviders from '@/components/RootProviders'
import './globals.css'

export const metadata: Metadata = {
  title: 'SIC — Sistema Interno de Control',
  description: 'SIC es la herramienta de gestión interna para comercios. Turnos, ventas, empleados y reportes en un solo lugar.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sic-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`,
          }}
        />
        <RootProviders>
          {children}
        </RootProviders>
      </body>
    </html>
  )
}

