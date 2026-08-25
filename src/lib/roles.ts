export const APP_ROLES = ['OWNER', 'EMPLOYEE', 'SUPERADMIN'] as const

export type AppRole = (typeof APP_ROLES)[number]

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole)
}

export const ROLE_HOME: Record<AppRole, '/owner' | '/employee'> = {
  OWNER: '/owner',
  EMPLOYEE: '/employee',
  SUPERADMIN: '/owner',
}

export const ROLE_ACCESS: Record<'owner' | 'employee', readonly AppRole[]> = {
  owner: ['OWNER', 'SUPERADMIN'],
  // El dueño puede operar la caja además de administrar el comercio.
  employee: ['OWNER', 'EMPLOYEE', 'SUPERADMIN'],
}

export function canAccessArea(role: AppRole, area: keyof typeof ROLE_ACCESS): boolean {
  return ROLE_ACCESS[area].includes(role)
}

export function canAccessPath(role: AppRole, path: string): boolean {
  if (path === '/dashboard') return true
  if (path === '/owner' || path.startsWith('/owner/')) return canAccessArea(role, 'owner')
  if (path === '/employee' || path.startsWith('/employee/')) return canAccessArea(role, 'employee')
  return false
}
