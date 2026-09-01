'use client'

import { usePathname } from 'next/navigation'
import { UserRoleProvider } from '@/lib/UserRoleContext'

export default function RootProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/')

  // El panel SIDEA Admin usa su propia sesión HttpOnly (/api/admin-*).
  // No debe inicializar Supabase Auth ni UserRoleProvider.
  if (isAdminArea) {
    return <>{children}</>
  }

  return <UserRoleProvider>{children}</UserRoleProvider>
}
