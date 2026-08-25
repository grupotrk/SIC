import type { AppRole } from '@/lib/roles'

export type ExportFormat = 'PDF'

export type ExportCapability = {
  key: string
  title: string
  description: string
  formats: ExportFormat[]
}

const OWNER_EXPORTS: ExportCapability[] = [
  {
    key: 'resumen_cierre_diario',
    title: 'Resumen diario de caja',
    description: 'Totales del dia por medio de pago y cantidad de operaciones.',
    formats: ['PDF'],
  },
  {
    key: 'ventas_empleados',
    title: 'Ventas por empleado',
    description: 'Consolidado de ventas por cajero para auditoria y performance.',
    formats: ['PDF'],
  },
  {
    key: 'cierres_historicos',
    title: 'Historial de cierres',
    description: 'Cierres diarios historicos para control administrativo.',
    formats: ['PDF'],
  },
]

const EMPLOYEE_EXPORTS: ExportCapability[] = [
  {
    key: 'arqueo_turno_personal',
    title: 'Arqueo de turno personal',
    description: 'Detalle del turno actual del empleado autenticado.',
    formats: ['PDF'],
  },
  {
    key: 'tickets_turno_personal',
    title: 'Tickets del turno personal',
    description: 'Listado de ventas realizadas por el empleado en su turno.',
    formats: ['PDF'],
  },
]

export function getExportCapabilitiesByRole(role: AppRole): ExportCapability[] {
  if (role === 'SUPERADMIN') {
    return [...OWNER_EXPORTS, ...EMPLOYEE_EXPORTS]
  }
  return role === 'OWNER' ? OWNER_EXPORTS : EMPLOYEE_EXPORTS
}
