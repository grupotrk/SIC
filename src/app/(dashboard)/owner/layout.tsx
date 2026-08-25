import { redirect } from 'next/navigation'
import { getServerSessionRole } from '@/lib/serverSession'
import { canAccessArea, ROLE_HOME } from '@/lib/roles'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const role = await getServerSessionRole()

  if (!role) {
    redirect('/login')
  }

  if (!canAccessArea(role, 'owner')) {
    redirect(ROLE_HOME[role])
  }

  return <>{children}</>
}
