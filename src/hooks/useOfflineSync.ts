'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface PendingSaleItem {
  id: string
  nombre: string
  precio_venta: number
  quantity: number
}

export interface PendingSale {
  syncId: string
  tenantId: string
  comercioUsuarioId: string
  turnoId: string
  metodoPago: string
  total: number
  createdAt: string
  items: PendingSaleItem[]
}

export interface PendingOfflineIncident {
  reportId: string
  tenantId: string
  comercioUsuarioId: string
  turnoId?: string
  offlineDetectedAt: string
  reportCreatedAt: string
  pendingSalesCount: number
}

export const OFFLINE_SALES_QUEUE_KEY = 'sic_offline_sales_queue_v1'
const OFFLINE_INCIDENTS_QUEUE_KEY = 'sic_offline_incidents_queue_v1'
const ACTIVE_OFFLINE_INCIDENT_KEY = 'sic_active_offline_incident_v1'

export function getOfflineSalesQueue(): PendingSale[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(OFFLINE_SALES_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingSale[]) : []
  } catch {
    return []
  }
}

export function setOfflineSalesQueue(queue: PendingSale[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(OFFLINE_SALES_QUEUE_KEY, JSON.stringify(queue))
}

function getOfflineIncidentsQueue(): PendingOfflineIncident[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(OFFLINE_INCIDENTS_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingOfflineIncident[]) : []
  } catch {
    return []
  }
}

function setOfflineIncidentsQueue(queue: PendingOfflineIncident[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(OFFLINE_INCIDENTS_QUEUE_KEY, JSON.stringify(queue))
}

function getActiveOfflineIncident(): PendingOfflineIncident | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ACTIVE_OFFLINE_INCIDENT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingOfflineIncident
  } catch {
    return null
  }
}

function setActiveOfflineIncident(incident: PendingOfflineIncident | null): void {
  if (typeof window === 'undefined') return
  if (!incident) {
    window.localStorage.removeItem(ACTIVE_OFFLINE_INCIDENT_KEY)
    return
  }
  window.localStorage.setItem(ACTIVE_OFFLINE_INCIDENT_KEY, JSON.stringify(incident))
}

export function createSyncId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function isProbablyNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (error instanceof Error) {
    const lower = error.message.toLowerCase()
    return lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline')
  }
  return false
}

interface UserRole {
  id: string
  tenantId: string
  rol: string
}

interface UseOfflineSyncProps {
  userRole: UserRole | null
  turnoActivoId?: string
  onSyncSuccess?: () => void // Callback para recargar productos, etc.
}

export function useOfflineSync({ userRole, turnoActivoId, onSyncSuccess }: UseOfflineSyncProps) {
  const isMountedRef = useRef(true)
  const syncingOfflineSalesRef = useRef(false)
  const syncingOfflineIncidentsRef = useRef(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSalesCount, setPendingSalesCount] = useState(0)
  const [pendingIncidentCount, setPendingIncidentCount] = useState(0)
  const [syncingOfflineSales, setSyncingOfflineSales] = useState(false)
  const [syncingOfflineIncidents, setSyncingOfflineIncidents] = useState(false)
  const [offlineStartedAt, setOfflineStartedAt] = useState<string | null>(null)
  const [lastSyncResult, setLastSyncResult] = useState<{ count: number; at: string } | null>(null)
  const [mensajeSync, setMensajeSync] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)

  const updatePendingSalesCount = () => {
    if (!isMountedRef.current) return
    setPendingSalesCount(getOfflineSalesQueue().length)
  }

  const refreshOfflineIncidentState = () => {
    if (!isMountedRef.current) return
    const queue = getOfflineIncidentsQueue()
    const activeIncident = getActiveOfflineIncident()
    setPendingIncidentCount(queue.length + (activeIncident ? 1 : 0))
    setOfflineStartedAt(activeIncident?.offlineDetectedAt ?? null)
  }

  const enqueueOfflineSale = (sale: PendingSale) => {
    const queue = getOfflineSalesQueue()
    queue.push(sale)
    setOfflineSalesQueue(queue)
    if (isMountedRef.current) setPendingSalesCount(queue.length)
  }

  const createAutomaticOfflineIncident = () => {
    if (!userRole) return

    const existingIncident = getActiveOfflineIncident()
    if (existingIncident) {
      setOfflineStartedAt(existingIncident.offlineDetectedAt)
      refreshOfflineIncidentState()
      return
    }

    const now = new Date().toISOString()
    const incident: PendingOfflineIncident = {
      reportId: createSyncId(),
      tenantId: userRole.tenantId,
      comercioUsuarioId: userRole.id,
      turnoId: turnoActivoId,
      offlineDetectedAt: now,
      reportCreatedAt: now,
      pendingSalesCount: getOfflineSalesQueue().length,
    }

    setActiveOfflineIncident(incident)
    setOfflineStartedAt(now)
    refreshOfflineIncidentState()
  }

  const queueActiveOfflineIncidentForSync = () => {
    const activeIncident = getActiveOfflineIncident()
    if (!activeIncident) return

    const queue = getOfflineIncidentsQueue()
    if (!queue.some((item) => item.reportId === activeIncident.reportId)) {
      queue.push(activeIncident)
      setOfflineIncidentsQueue(queue)
    }

    setActiveOfflineIncident(null)
    refreshOfflineIncidentState()
  }

  const persistOfflineIncidentOnline = async (
    incident: PendingOfflineIncident,
    syncedSalesCount: number,
    connectionRestoredAt: string
  ) => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Sesión expirada')
    }

    const response = await fetch('/api/offline-incidents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        reportId: incident.reportId,
        offlineDetectedAt: incident.offlineDetectedAt,
        reportCreatedAt: incident.reportCreatedAt,
        connectionRestoredAt,
        syncedAt: new Date().toISOString(),
        pendingSalesCount: incident.pendingSalesCount,
        syncedSalesCount,
        turnoId: incident.turnoId ?? null,
      }),
    })

    if (!response.ok) {
      throw new Error('No se pudo registrar el incidente offline')
    }
  }

  const persistSaleOnline = async (sale: PendingSale) => {
    const { error } = await supabase.rpc('registrar_venta_offline_atomic', {
      p_sync_id: sale.syncId,
      p_turno_id: sale.turnoId,
      p_metodo_pago: sale.metodoPago,
      p_items: sale.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        precio_venta: item.precio_venta,
      })),
    })

    if (error) {
      throw error
    }
  }

  const syncOfflineSales = async (): Promise<number> => {
    if (syncingOfflineSalesRef.current) return 0
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0

    const queue = getOfflineSalesQueue()
    if (queue.length === 0) {
      if (isMountedRef.current) setPendingSalesCount(0)
      return 0
    }

    syncingOfflineSalesRef.current = true
    if (isMountedRef.current) setSyncingOfflineSales(true)
    let synced = 0
    const remaining: PendingSale[] = []

    for (const sale of queue) {
      try {
        await persistSaleOnline(sale)
        synced += 1
      } catch {
        remaining.push(sale)
      }
    }

    setOfflineSalesQueue(remaining)
    syncingOfflineSalesRef.current = false
    if (!isMountedRef.current) return synced

    setPendingSalesCount(remaining.length)
    setSyncingOfflineSales(false)

    if (synced > 0) {
      if (onSyncSuccess) onSyncSuccess()
      setLastSyncResult({ count: synced, at: new Date().toISOString() })
      setTimeout(() => { if (isMountedRef.current) setLastSyncResult(null) }, 6000)
    }

    return synced
  }

  const syncOfflineIncidents = async (syncedSalesCount: number, connectionRestoredAt: string) => {
    if (syncingOfflineIncidentsRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    const queue = getOfflineIncidentsQueue()
    if (queue.length === 0) {
      refreshOfflineIncidentState()
      return
    }

    syncingOfflineIncidentsRef.current = true
    if (isMountedRef.current) setSyncingOfflineIncidents(true)
    let syncedIncidents = 0
    const remaining: PendingOfflineIncident[] = []

    for (const incident of queue) {
      try {
        await persistOfflineIncidentOnline(incident, syncedSalesCount, connectionRestoredAt)
        syncedIncidents += 1
      } catch {
        remaining.push(incident)
      }
    }

    setOfflineIncidentsQueue(remaining)
    syncingOfflineIncidentsRef.current = false
    if (!isMountedRef.current) return

    setSyncingOfflineIncidents(false)
    refreshOfflineIncidentState()

    if (syncedIncidents > 0) {
      setMensajeSync({
        tipo: 'success',
        texto: `${syncedIncidents} aviso(s) automatico(s) de internet caido registrado(s) en auditoria.${syncedSalesCount > 0 ? ` Ventas sincronizadas: ${syncedSalesCount}.` : ''}`,
      })
      setTimeout(() => { if (isMountedRef.current) setMensajeSync(null) }, 4500)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      queueActiveOfflineIncidentForSync()
      void (async () => {
        const syncedSales = await syncOfflineSales()
        await syncOfflineIncidents(syncedSales, new Date().toISOString())
      })()
    }

    const handleOffline = () => {
      setIsOnline(false)
      createAutomaticOfflineIncident()
      setMensajeSync({ tipo: 'error', texto: 'Internet caido detectado automaticamente. Las ventas nuevas se guardaran para sincronizar luego.' })
    }

    setIsOnline(window.navigator.onLine)
    updatePendingSalesCount()
    refreshOfflineIncidentState()

    if (!window.navigator.onLine) {
      createAutomaticOfflineIncident()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (window.navigator.onLine) {
      queueActiveOfflineIncidentForSync()
      void (async () => {
        const syncedSales = await syncOfflineSales()
        await syncOfflineIncidents(syncedSales, new Date().toISOString())
      })()
    }

    return () => {
      isMountedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, turnoActivoId])

  return {
    isOnline,
    pendingSalesCount,
    pendingIncidentCount,
    syncingOfflineSales,
    syncingOfflineIncidents,
    offlineStartedAt,
    lastSyncResult,
    mensajeSync,
    setMensajeSync,
    enqueueOfflineSale,
    syncOfflineSales, // Para forzar un sync manual si hace falta
  }
}
