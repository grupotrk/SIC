/**
 * Tipos compartidos entre componentes del dominio de empleados y turnos.
 * Importar desde '@/types' en lugar de declarar localmente en cada componente.
 */

export interface Turno {
  id: string
  estado: string
  caja_inicial: number
}

export interface UserRole {
  id: string
  tenantId: string
  authUserId?: string
  nombre?: string
  email?: string
  rol: string
  activo?: boolean
  metadata?: Record<string, unknown>
}
