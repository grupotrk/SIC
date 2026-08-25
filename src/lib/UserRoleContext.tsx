'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/lib/roles'

export interface UserRole {
  id: string
  tenantId: string
  authUserId: string
  nombre: string
  email: string
  rol: AppRole
  activo: boolean
  metadata?: Record<string, unknown>
}

interface UserRoleContextType {
  userRole: UserRole | null
  loading: boolean
  refreshUserRole: () => Promise<void>
}

type SessionRoleResponse =
  | { ok: true; role: AppRole; profile: UserRole }
  | { ok: false; error?: string }

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined)

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const syncRoleFromAccessToken = useCallback(async (accessToken: string) => {
    setLoading(true)

    try {
      // Esta API es la única fuente de verdad para rol + perfil y además
      // renueva las cookies HttpOnly que usa la autorización server-side.
      const response = await fetch('/api/session-role', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      })

      const payload = (await response.json().catch(() => null)) as SessionRoleResponse | null

      if (!response.ok || !payload?.ok) {
        setUserRole(null)
        return
      }

      setUserRole(payload.profile)
    } catch (error) {
      console.error('Error loading user role:', error)
      setUserRole(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadUserRole = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setUserRole(null)
      setLoading(false)
      return
    }
    await syncRoleFromAccessToken(session.access_token)
  }, [syncRoleFromAccessToken])

  useEffect(() => {
    void loadUserRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUserRole(null)
        setLoading(false)
        if (event === 'SIGNED_OUT') router.replace('/login')
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void syncRoleFromAccessToken(session.access_token)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUserRole, router, syncRoleFromAccessToken])

  return (
    <UserRoleContext.Provider value={{ userRole, loading, refreshUserRole: loadUserRole }}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole() {
  const context = useContext(UserRoleContext)
  if (!context) {
    throw new Error('useUserRole debe usarse dentro de UserRoleProvider')
  }
  return context
}
