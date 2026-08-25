import { cookies } from 'next/headers'
import { verifyCookieValue } from '@/lib/cookieSigning'
import { isAppRole, type AppRole } from '@/lib/roles'

export async function getServerSessionRole(): Promise<AppRole | null> {
  const cookieStore = await cookies()
  const hasSession = cookieStore.get('trikode_session')?.value === '1'
  const signedRole = cookieStore.get('trikode_role')?.value

  if (!hasSession || !signedRole) return null

  const verifiedRole = await verifyCookieValue(signedRole)
  return isAppRole(verifiedRole) ? verifiedRole : null
}
