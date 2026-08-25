import { redirect } from 'next/navigation'
import { getServerSessionRole } from '@/lib/serverSession'
import { ROLE_HOME } from '@/lib/roles'

export default async function DashboardPage() {
  const role = await getServerSessionRole()

  if (!role) {
    redirect('/login')
  }

  redirect(ROLE_HOME[role])
}
