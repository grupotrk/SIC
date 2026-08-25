export type AccessMode = 'FULL' | 'DOWNLOAD_ONLY' | 'BLOCKED'
export type SubscriptionUiStatus = 'ACTIVO' | 'EN_GRACIA' | 'SOLO_DESCARGA' | 'BLOQUEADO'

export type CommerceLifecycleRow = {
  estado_suscripcion?: string | null
  suscripcion_vence_at?: string | null
  solo_descarga_hasta?: string | null
  baja_solicitada_at?: string | null
  activo?: boolean | null
  depurado_at?: string | null
}

export type SubscriptionComputed = {
  accessMode: AccessMode
  status: SubscriptionUiStatus
  daysOverdue: number
  graceDaysRemaining: number
  downloadDaysRemaining: number
  cancelRequested: boolean
  dueDate: string | null
  downloadUntil: string | null
  isTrial: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

function parseDateOnly(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`)
}

function todayUtcDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS)
}

export function computeSubscriptionState(row: CommerceLifecycleRow | null): SubscriptionComputed {
  const today = todayUtcDate()
  const isTrial = String(row?.estado_suscripcion || '').toUpperCase() === 'TRIAL'

  if (!row || row.depurado_at) {
    return {
      accessMode: 'BLOCKED',
      status: 'BLOQUEADO',
      daysOverdue: 0,
      graceDaysRemaining: 0,
      downloadDaysRemaining: 0,
      cancelRequested: false,
      dueDate: null,
      downloadUntil: null,
      isTrial: false,
    }
  }

  const dueDate = row.suscripcion_vence_at ? parseDateOnly(row.suscripcion_vence_at) : null
  const downloadUntil = row.solo_descarga_hasta ? parseDateOnly(row.solo_descarga_hasta) : null
  const cancelRequested = Boolean(row.baja_solicitada_at)

  if (!dueDate) {
    return {
      accessMode: 'FULL',
      status: 'ACTIVO',
      daysOverdue: 0,
      graceDaysRemaining: 7,
      downloadDaysRemaining: downloadUntil ? Math.max(0, diffDays(downloadUntil, today)) : 90,
      cancelRequested,
      dueDate: row.suscripcion_vence_at || null,
      downloadUntil: row.solo_descarga_hasta || null,
      isTrial,
    }
  }

  const overdue = diffDays(today, dueDate)

  if (overdue <= 0) {
    return {
      accessMode: 'FULL',
      status: 'ACTIVO',
      daysOverdue: 0,
      graceDaysRemaining: 7,
      downloadDaysRemaining: downloadUntil ? Math.max(0, diffDays(downloadUntil, today)) : 90,
      cancelRequested,
      dueDate: row.suscripcion_vence_at || null,
      downloadUntil: row.solo_descarga_hasta || null,
      isTrial,
    }
  }

  if (overdue <= 7) {
    return {
      accessMode: 'FULL',
      status: 'EN_GRACIA',
      daysOverdue: overdue,
      graceDaysRemaining: 7 - overdue,
      downloadDaysRemaining: downloadUntil ? Math.max(0, diffDays(downloadUntil, today)) : 90,
      cancelRequested,
      dueDate: row.suscripcion_vence_at || null,
      downloadUntil: row.solo_descarga_hasta || null,
      isTrial,
    }
  }

  const downloadDaysRemaining = downloadUntil ? Math.max(0, diffDays(downloadUntil, today)) : 0
  if (downloadUntil && downloadDaysRemaining >= 0) {
    if (today.getTime() <= downloadUntil.getTime()) {
      return {
        accessMode: 'DOWNLOAD_ONLY',
        status: 'SOLO_DESCARGA',
        daysOverdue: overdue,
        graceDaysRemaining: 0,
        downloadDaysRemaining,
        cancelRequested,
        dueDate: row.suscripcion_vence_at || null,
        downloadUntil: row.solo_descarga_hasta || null,
        isTrial,
      }
    }
  }

  return {
    accessMode: 'BLOCKED',
    status: 'BLOQUEADO',
    daysOverdue: overdue,
    graceDaysRemaining: 0,
    downloadDaysRemaining: 0,
    cancelRequested,
    dueDate: row.suscripcion_vence_at || null,
    downloadUntil: row.solo_descarga_hasta || null,
    isTrial,
  }
}
