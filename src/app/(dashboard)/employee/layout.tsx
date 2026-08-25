import { redirect } from 'next/navigation'
import { getServerSessionRole } from '@/lib/serverSession'
import { canAccessArea, ROLE_HOME } from '@/lib/roles'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const role = await getServerSessionRole()

  if (!role) {
    redirect('/login')
  }

  if (!canAccessArea(role, 'employee')) {
    redirect(ROLE_HOME[role])
  }

  return <>{children}</>
}
