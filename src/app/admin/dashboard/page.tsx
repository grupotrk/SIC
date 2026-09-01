'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Cliente = {
  id: string
  tenant_id?: string | null
  nombre_comercio: string
  rubro: string
  whatsapp: string
  email?: string | null
  estado: string
  is_trial?: boolean
  dias_transcurridos: number
  fecha_vencimiento: string
  precio_mensual?: number | null
  comision_mensual?: number | null
  ingreso_neto_mensual?: number | null
  vendedor_nombre?: string | null
  vendedor_codigo?: string | null
  owner_activation_needs_attention?: boolean
  owner_activation_label?: string | null
  owner_activation_detail?: string | null
  owner_invite_attempts?: number | null
  owner_last_invite_at?: string | null
  owner_last_invite_status?: string | null
  owner_last_invite_error?: string | null
  commerce_active?: boolean | null
}

type NotifLog = {
  id: string
  lead_id: string | null
  tipo: string | null
  motivo: string | null
  enviado: boolean | null
  error_message: string | null
  created_at: string
  nombre_comercio: string | null
}

type SalesAgent = {
  id: string
  nombre: string
  email?: string | null
  ref_code?: string | null
  status?: string | null
  inactive_from?: string | null
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [salesAgents, setSalesAgents] = useState<SalesAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')
  const [salesStatus, setSalesStatus] = useState('')
  const [section, setSection] = useState<'clientes' | 'estadisticas' | 'notificaciones' | 'configuracion'>('clientes')

  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroRubro, setFiltroRubro] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [nombreVendedor, setNombreVendedor] = useState('')
  const [tipoCodigo, setTipoCodigo] = useState<'AV' | 'CT' | 'DU'>('AV')
  const [whatsappVendedor, setWhatsappVendedor] = useState('')
  const [emailVendedor, setEmailVendedor] = useState('')
  const [guardandoVendedor, setGuardandoVendedor] = useState(false)

  // Alta manual de comercios / tenants
  const [showNewCommerce, setShowNewCommerce] = useState(false)
  const [newCommerce, setNewCommerce] = useState({ nombre_comercio: '', rubro: 'Kiosco', whatsapp: '', email: '', owner_nombre: '', owner_username: '', owner_password: '', trial_days: 7 })
  const [creatingCommerce, setCreatingCommerce] = useState(false)

  // Eliminación definitiva de tenants de prueba / altas erróneas
  const [commerceToDelete, setCommerceToDelete] = useState<Cliente | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingCommerce, setDeletingCommerce] = useState(false)
  const [changingCommerceStatus, setChangingCommerceStatus] = useState<string | null>(null)

  // Notificaciones
  const [notifLogs, setNotifLogs] = useState<NotifLog[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [notifTab, setNotifTab] = useState<'alertas' | 'historial'>('alertas')

  useEffect(() => {
    void init()
  }, [])

  useEffect(() => {
    if (section !== 'notificaciones') return
    setLoadingNotifs(true)
    fetch('/api/admin-notifications', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setNotifLogs(d.logs || []) })
      .catch(() => undefined)
      .finally(() => setLoadingNotifs(false))
  }, [section])

  const init = async () => {
    const ok = await checkAuth()
    if (!ok) return
    await Promise.all([loadClients(), loadSalesAgents()])
    setLoading(false)
  }

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin-verify', {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        router.replace('/admin')
        return false
      }

      return true
    } catch {
      router.replace('/admin')
      return false
    }
  }

  const loadClients = async () => {
    try {
      const res = await fetch('/api/admin-leads', {
        credentials: 'include',
        cache: 'no-store',
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 503 && payload?.error === 'server_not_configured') {
          setStatusMessage('Falta configurar Supabase en variables de entorno del servidor para ver clientes reales.')
        } else {
          setStatusMessage('No se pudo cargar la lista de clientes.')
        }
        setClientes([])
        return
      }

      const nextClientes = Array.isArray(payload?.clientes) ? payload.clientes : []
      setClientes(nextClientes)

      const ownerPendingCount = nextClientes.filter((c) => c.owner_activation_needs_attention).length
      if (ownerPendingCount > 0) {
        setStatusMessage(`Hay ${ownerPendingCount} comercio${ownerPendingCount === 1 ? '' : 's'} con activación OWNER pendiente o incompleta.`)
      } else {
        setStatusMessage('')
      }
    } catch {
      setStatusMessage('Error de conexión cargando clientes.')
      setClientes([])
    }
  }

  const loadSalesAgents = async () => {
    try {
      const res = await fetch('/api/admin-sales-agents', {
        credentials: 'include',
        cache: 'no-store',
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) {
        setSalesStatus('No se pudo cargar la lista de vendedores.')
        setSalesAgents([])
        return
      }

      setSalesAgents(Array.isArray(payload.agents) ? payload.agents : [])
      setSalesStatus('')
    } catch {
      setSalesStatus('Error de conexión cargando vendedores.')
      setSalesAgents([])
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/admin-logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      router.replace('/admin')
    }
  }

  const provisionSuperAdminUser = async () => {
    try {
      setStatusMessage('Provisionando Usuario 0 de auditoría...')
      const res = await fetch('/api/admin-provision-superadmin', {
        method: 'POST',
        credentials: 'include',
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error === 'server_not_configured'
          ? 'Faltan variables de entorno para provisionar el SuperAdmin.'
          : 'No se pudo provisionar el Usuario 0 de auditoría.')
      }

      const email = payload?.email || 'test@trikode.com.ar'
      setStatusMessage(`SuperAdmin listo: ${email}.`)
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'No se pudo provisionar el Usuario 0.')
    }
  }

  const resendOwnerInvite = async (leadId: string) => {
    try {
      const res = await fetch('/api/admin-owner-invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        const errorCode = payload?.error || 'unexpected'
        if (errorCode === 'owner_email_missing') throw new Error('El comercio no tiene email válido para activar al OWNER.')
        if (errorCode === 'commerce_not_found') throw new Error('No se encontró el comercio dado de alta para este lead.')
        if (errorCode === 'lead_not_paid') throw new Error('Solo se puede reenviar la activación en comercios con pago aprobado.')
        if (errorCode === 'invite_failed') throw new Error('No se pudo reenviar la invitación automática.')
        throw new Error('No se pudo reenviar la activación OWNER.')
      }

      await loadClients()
      setStatusMessage(payload?.result === 'already_ready'
        ? 'El OWNER ya estaba vinculado. Se normalizó el estado.'
        : 'La activación del OWNER fue reenviada correctamente.')
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'No se pudo reenviar la activación OWNER.')
    }
  }

  const createCommerce = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creatingCommerce) return

    try {
      setCreatingCommerce(true)
      setStatusMessage('Creando comercio y cuenta OWNER...')
      const res = await fetch('/api/admin-create-commerce', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCommerce),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) {
        const code = payload?.error || 'unexpected'
        const messages: Record<string, string> = {
          email_exists: 'Ese email ya está registrado.',
          username_exists: 'Ese usuario OWNER ya está en uso.',
          invalid_password: 'La contraseña debe tener al menos 8 caracteres y combinar letras y números.',
          rubro_not_found: 'No se encontró ese rubro en Supabase.',
          plan_not_found: 'No hay un plan configurado.',
          tenant_provision_failed: 'No se pudo crear el tenant.',
        }
        throw new Error(messages[code] || `No se pudo crear el comercio (${code}).`)
      }

      setShowNewCommerce(false)
      setNewCommerce({ nombre_comercio: '', rubro: 'Kiosco', whatsapp: '', email: '', owner_nombre: '', owner_username: '', owner_password: '', trial_days: 7 })
      await loadClients()
      setStatusMessage(`Comercio creado. Tenant: ${payload.tenant_id}. OWNER: ${payload.owner_username}`)
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'No se pudo crear el comercio.')
    } finally {
      setCreatingCommerce(false)
    }
  }


  const setCommerceActive = async (cliente: Cliente, active: boolean) => {
    if (!cliente.tenant_id) return
    setChangingCommerceStatus(cliente.tenant_id)
    setStatusMessage(active ? 'Reactivando comercio...' : 'Desactivando comercio...')
    try {
      const res = await fetch('/api/admin-commerce-status', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: cliente.tenant_id, active }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) throw new Error(active ? 'No se pudo reactivar el comercio.' : 'No se pudo desactivar el comercio.')
      setStatusMessage(active ? 'Comercio reactivado.' : 'Comercio desactivado. Conserva sus datos pero no puede operar.')
      await loadClients()
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'No se pudo cambiar el estado del comercio.')
    } finally {
      setChangingCommerceStatus(null)
    }
  }

  const deleteCommercePermanently = async () => {
    if (!commerceToDelete?.tenant_id || deletingCommerce) return

    const expected = commerceToDelete.nombre_comercio.trim()
    if (deleteConfirmation.trim() !== expected) {
      setStatusMessage(`Escribí exactamente “${expected}” para confirmar la eliminación.`)
      return
    }

    try {
      setDeletingCommerce(true)
      setStatusMessage(`Eliminando definitivamente ${expected}...`)

      const res = await fetch('/api/admin-delete-commerce', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: commerceToDelete.tenant_id,
          confirm_name: deleteConfirmation.trim(),
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) {
        const code = payload?.error || 'unexpected'
        const messages: Record<string, string> = {
          commerce_not_found: 'El comercio ya no existe.',
          confirmation_mismatch: 'El nombre de confirmación no coincide.',
          protected_tenant: 'Ese tenant está reservado como sandbox de un Superadmin y no se puede eliminar desde acá.',
          tenant_delete_failed: 'No se pudo borrar completamente el tenant. No se eliminó el usuario de Auth.',
          auth_delete_failed: 'Los datos del tenant se borraron, pero no se pudo eliminar uno de sus usuarios de Auth.',
        }
        throw new Error(messages[code] || `No se pudo eliminar el comercio (${code}).`)
      }

      setCommerceToDelete(null)
      setDeleteConfirmation('')
      await loadClients()
      setStatusMessage(`“${expected}” fue eliminado definitivamente, incluidos sus usuarios de acceso.`)
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'No se pudo eliminar el comercio.')
    } finally {
      setDeletingCommerce(false)
    }
  }

  const createSalesAgent = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nombreVendedor.trim() || nombreVendedor.trim().length < 2) {
      setSalesStatus('Ingresá un nombre válido para el vendedor.')
      return
    }

    setGuardandoVendedor(true)
    try {
      const commissionRate = tipoCodigo === 'DU' ? 0 : 0.3

      const res = await fetch('/api/admin-sales-agents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreVendedor.trim(),
          referral_type: tipoCodigo,
          whatsapp: whatsappVendedor.trim(),
          email: emailVendedor.trim(),
          commission_rate: commissionRate,
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) {
        setSalesStatus(payload?.error === 'active_agent_exists'
          ? 'Ya existe un vendedor activo con ese nombre.'
          : 'No se pudo guardar el vendedor.')
        return
      }

      setSalesStatus(`Código ${payload?.mode === 'rejoined' ? 'reactivado' : 'creado'}: ${payload?.ref_code || '-'}`)
      setNombreVendedor('')
      setWhatsappVendedor('')
      setEmailVendedor('')
      setTipoCodigo('AV')
      await loadSalesAgents()
    } catch {
      setSalesStatus('Error de conexión guardando vendedor.')
    } finally {
      setGuardandoVendedor(false)
    }
  }

  const deactivateSalesAgent = async (id: string) => {
    const ok = window.confirm('¿Seguro que querés dar de baja este vendedor?')
    if (!ok) return

    try {
      const res = await fetch('/api/admin-sales-agents', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'deactivate' }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) {
        setSalesStatus('No se pudo dar de baja el vendedor.')
        return
      }

      setSalesStatus('Vendedor dado de baja.')
      await loadSalesAgents()
    } catch {
      setSalesStatus('Error de conexión al dar de baja vendedor.')
    }
  }

  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      if (filtroEstado && c.estado !== filtroEstado) return false
      if (filtroRubro && c.rubro !== filtroRubro) return false
      if (filtroVendedor && (c.vendedor_nombre || '') !== filtroVendedor) return false

      const q = busqueda.toLowerCase()
      if (!q) return true

      return (
        (c.nombre_comercio || '').toLowerCase().includes(q) ||
        (c.whatsapp || '').includes(q) ||
        (c.vendedor_codigo || '').toLowerCase().includes(q)
      )
    })
  }, [clientes, filtroEstado, filtroRubro, filtroVendedor, busqueda])

  const stats = useMemo(() => {
    const total = clientes.length
    const trials = clientes.filter((c) => c.estado === 'Trial').length
    const activos = clientes.filter((c) => c.estado === 'Activo').length
    const porVencer = clientes.filter((c) => c.estado === 'Por vencer').length
    const enGracia = clientes.filter((c) => c.estado === 'En gracia').length
    const soloDescarga = clientes.filter((c) => c.estado === 'Solo descarga').length
    const vencidos = clientes.filter((c) => c.estado === 'Vencido').length

    // MRR: solo comercios activos pagos (± por vencer), excluye trial, gracia, descarga y vencido
    const baseMensual = clientes.filter((c) => !c.is_trial && (c.estado === 'Activo' || c.estado === 'Por vencer'))
    const ingresosMensuales = baseMensual.reduce((acc, c) => acc + (Number(c.precio_mensual) || 0), 0)
    const comisionesMensuales = baseMensual.reduce((acc, c) => acc + (Number(c.comision_mensual) || 0), 0)
    const netoMensual = Math.max(0, ingresosMensuales - comisionesMensuales)
    const ticketPromedio = baseMensual.length > 0 ? Math.round(ingresosMensuales / baseMensual.length) : 0

    // Pipeline de conversión
    const hoy = new Date()
    const trialsUrgentes = clientes.filter((c) => {
      if (c.estado !== 'Trial' || !c.fecha_vencimiento) return false
      const due = new Date(c.fecha_vencimiento)
      return Math.ceil((due.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) <= 3
    }).length
    const conversionRate = total > 0 ? Math.round(((activos + porVencer) / total) * 100) : 0

    return { total, trials, activos, porVencer, enGracia, soloDescarga, vencidos, ingresosMensuales, comisionesMensuales, netoMensual, ticketPromedio, trialsUrgentes, conversionRate }
  }, [clientes])

  const vendedores = Array.from(
    new Set(clientes.map((c) => (c.vendedor_nombre || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es'))
  const alertas = useMemo(() => {
    const hoy = new Date()
    const trialsUrgentes = clientes.filter((c) => {
      if (c.estado !== 'Trial' || !c.fecha_vencimiento) return false
      const due = new Date(c.fecha_vencimiento)
      return Math.ceil((due.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) <= 3
    })
    const enGracia = clientes.filter((c) => c.estado === 'En gracia')
    const soloDescarga = clientes.filter((c) => c.estado === 'Solo descarga')
    const vencidos = clientes.filter((c) => c.estado === 'Vencido')
    const ownerPendiente = clientes.filter((c) => !!c.owner_activation_needs_attention && c.estado !== 'Vencido')
    return { trialsUrgentes, enGracia, soloDescarga, vencidos, ownerPendiente }
  }, [clientes])

  const totalAlertas = alertas.trialsUrgentes.length + alertas.enGracia.length + alertas.soloDescarga.length + alertas.vencidos.length + alertas.ownerPendiente.length

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,#15345f_0%,#0b1730_100%)] text-white">Cargando panel admin...</div>
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#15345f_0%,#0b1730_100%)] text-white">
      <div className="flex min-h-screen">
        <aside className="m-4 w-64 rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md flex flex-col">
          <div className="mb-8">
            <h1 className="text-2xl font-black text-[#98ce4f]">ADMIN</h1>
            <p className="text-sm text-slate-400">Trikode Panel</p>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              ['clientes', 'Clientes'],
              ['estadisticas', 'Estadísticas'],
              ['notificaciones', 'Notificaciones'],
              ['configuracion', 'Configuración'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSection(key as typeof section)}
                className={`relative w-full rounded-lg px-4 py-3 text-left ${
                  section === key
                    ? 'border-l-4 border-[#98ce4f] bg-[#98ce4f]/20'
                    : 'hover:bg-white/10'
                }`}
              >
                {label}
                {key === 'notificaciones' && totalAlertas > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold leading-none">
                    {totalAlertas}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="border-t border-slate-700 pt-4">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-slate-400">Admin</span>
              <span className="text-slate-500">Admin</span>
            </div>
            <button
              onClick={logout}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Cerrar Sesión
            </button>
          </div>
        </aside>

        <main className="m-4 flex-1">
          <div className="mb-6 rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">Panel de Administración</h2>
                <p className="text-slate-400">Gestión de clientes y suscripciones</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => void Promise.all([loadClients(), loadSalesAgents()])}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                >
                  Actualizar
                </button>
                <button
                  onClick={provisionSuperAdminUser}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                >
                  Provisionar Usuario 0
                </button>
                <button
                  onClick={logout}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>

          {section === 'clientes' && (
            <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
              <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
                <StatCard title="Total" value={String(stats.total)} color="text-white" />
                <StatCard title="Trial" value={String(stats.trials)} color="text-violet-400" />
                <StatCard title="Activos" value={String(stats.activos)} color="text-emerald-400" />
                <StatCard title="Por vencer" value={String(stats.porVencer)} color="text-yellow-400" />
                <StatCard title="En gracia" value={String(stats.enGracia)} color="text-orange-400" />
                <StatCard title="Solo desc." value={String(stats.soloDescarga)} color="text-blue-400" />
                <StatCard title="Vencidos" value={String(stats.vencidos)} color="text-red-400" />
                <StatCard title="MRR Neto" value={`$${stats.netoMensual.toLocaleString('es-AR')}`} color="text-emerald-300" />
              </div>

              <div className="mb-6 flex flex-wrap gap-4">
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2">
                  <option value="">Todos los estados</option>
                  <option value="Trial">Trial</option>
                  <option value="Activo">Activos</option>
                  <option value="Por vencer">Por vencer (≤7 días)</option>
                  <option value="En gracia">En gracia</option>
                  <option value="Solo descarga">Solo descarga</option>
                  <option value="Vencido">Vencidos</option>
                </select>

                <select value={filtroRubro} onChange={(e) => setFiltroRubro(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2">
                  <option value="">Todos los rubros</option>
                  <option value="Kiosco">Kiosco</option>
                  <option value="Rotisería">Rotisería</option>
                  <option value="Rotisería/Carrito">Rotisería/Carrito</option>
                  <option value="Ferretería">Ferretería</option>
                  <option value="Carnicería">Carnicería</option>
                  <option value="Carnicería/Verdulería">Carnicería/Verdulería</option>
                  <option value="Tienda de Mascotas">Tienda de Mascotas</option>
                  <option value="Librería">Librería</option>
                </select>

                <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2">
                  <option value="">Todos los vendedores</option>
                  {vendedores.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>

                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o WhatsApp..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 outline-none"
                />

                <button
                  onClick={() => setShowNewCommerce(true)}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  + Nuevo comercio
                </button>

                <button
                  onClick={() => exportCsv(filteredClientes)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                >
                  Exportar
                </button>
              </div>

              {statusMessage && (
                <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-900/20 p-4 text-sm text-yellow-200">
                  {statusMessage}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left">
                      <th className="p-4">Comercio</th>
                      <th className="p-4">Rubro</th>
                      <th className="p-4">Vendedor</th>
                      <th className="p-4">Código</th>
                      <th className="p-4">Plan</th>
                      <th className="p-4">WhatsApp</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4">Días</th>
                      <th className="p-4">Vencimiento</th>
                      <th className="p-4">Comisión Mes</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientes.map((cliente) => {
                      const comisionMensual = Number(cliente.comision_mensual) || 0
                      const dias = Number(cliente.dias_transcurridos) || 0
                      const wspMsg = encodeURIComponent(`Hola ${cliente.nombre_comercio}, soy Diego de SIDEA. Te contacto por tu suscripción.`)

                      return (
                        <tr key={cliente.id} className="border-b border-slate-800/70 hover:bg-white/5">
                          <td className="p-4">
                            <div className="font-semibold">{cliente.nombre_comercio}</div>
                            {cliente.email && <div className="text-xs text-slate-400">{cliente.email}</div>}
                            {cliente.tenant_id && cliente.commerce_active === false && (
                              <div className="mt-2 inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                                Comercio desactivado
                              </div>
                            )}

                            {cliente.owner_activation_needs_attention && (
                              <div className="mt-2">
                                <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-yellow-900/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-yellow-200">
                                  {cliente.owner_activation_label || 'Activación OWNER pendiente'}
                                </div>
                                {cliente.owner_activation_detail && (
                                  <div className="mt-2 text-xs text-yellow-100/90">{cliente.owner_activation_detail}</div>
                                )}
                                {cliente.email && (
                                  <button
                                    onClick={() => void resendOwnerInvite(cliente.id)}
                                    className="mt-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
                                  >
                                    Reenviar activación
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="p-4">
                            <span className="rounded bg-white/10 px-2 py-1 text-xs">{cliente.rubro}</span>
                          </td>
                          <td className="p-4">{cliente.vendedor_nombre || 'Sin vendedor'}</td>
                          <td className="p-4">
                            <span className="rounded bg-white/10 px-2 py-1 text-xs">{cliente.vendedor_codigo || '-'}</span>
                          </td>
                          <td className="p-4">
                            <span className="rounded bg-white/10 px-2 py-1 text-xs">SIDEA Completo</span>
                          </td>
                          <td className="p-4">{cliente.whatsapp}</td>
                          <td className="p-4">
                            <EstadoBadge estado={cliente.estado} />
                          </td>
                          <td className="p-4">{dias} días</td>
                          <td className="p-4">{new Date(cliente.fecha_vencimiento).toLocaleDateString('es-AR')}</td>
                          <td className="p-4">${comisionMensual.toLocaleString('es-AR')}</td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <a
                                href={`https://wa.me/549${cliente.whatsapp}?text=${wspMsg}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded border border-white/20 bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
                              >
                                WhatsApp
                              </a>
                              {cliente.email && (
                                <a
                                  href={`mailto:${cliente.email}?subject=SIDEA%20-%20Tu%20suscripción`}
                                  className="rounded border border-white/20 bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
                                >
                                  Email
                                </a>
                              )}
                              {cliente.tenant_id && (
                                <>
                                  <button
                                    type="button"
                                    disabled={changingCommerceStatus === cliente.tenant_id}
                                    onClick={() => void setCommerceActive(cliente, cliente.commerce_active === false)}
                                    className="rounded border border-blue-500/35 bg-blue-500/10 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/20 disabled:opacity-50"
                                  >
                                    {changingCommerceStatus === cliente.tenant_id
                                      ? 'Guardando...'
                                      : cliente.commerce_active === false ? 'Reactivar' : 'Desactivar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setCommerceToDelete(cliente); setDeleteConfirmation('') }}
                                    className="rounded border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20"
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {commerceToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl">
                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Zona peligrosa</div>
                  <h2 className="mt-1 text-2xl font-bold text-white">Eliminar comercio definitivamente</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Se eliminarán el tenant, productos, ventas, stock, turnos, cierres, usuarios vinculados y sus cuentas de acceso. Esta acción no se puede deshacer.
                  </p>
                </div>

                <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">
                  Vas a eliminar <strong>{commerceToDelete.nombre_comercio}</strong>.
                </div>

                <label className="mt-5 block text-sm text-slate-300">
                  Escribí <strong className="text-white">{commerceToDelete.nombre_comercio}</strong> para confirmar
                  <input
                    autoFocus
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-red-400"
                  />
                </label>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={deletingCommerce}
                    onClick={() => { setCommerceToDelete(null); setDeleteConfirmation('') }}
                    className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={deletingCommerce || deleteConfirmation.trim() !== commerceToDelete.nombre_comercio.trim()}
                    onClick={() => void deleteCommercePermanently()}
                    className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deletingCommerce ? 'Eliminando...' : 'Eliminar definitivamente'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showNewCommerce && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
              <form onSubmit={createCommerce} className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Alta administrada</div>
                    <h2 className="mt-1 text-2xl font-bold">Nuevo comercio</h2>
                    <p className="mt-1 text-sm text-slate-400">Crea el tenant y su cuenta OWNER en una sola operación.</p>
                  </div>
                  <button type="button" onClick={() => setShowNewCommerce(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800">✕</button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-slate-300">Nombre del comercio
                    <input required value={newCommerce.nombre_comercio} onChange={(e) => setNewCommerce(v => ({...v, nombre_comercio: e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label className="text-sm text-slate-300">Rubro
                    <select value={newCommerce.rubro} onChange={(e) => setNewCommerce(v => ({...v, rubro: e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
                      {['Kiosco','Rotisería','Ferretería','Carnicería','Tienda de Mascotas','Librería'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">Email OWNER
                    <input required type="email" value={newCommerce.email} onChange={(e) => setNewCommerce(v => ({...v, email: e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label className="text-sm text-slate-300">WhatsApp
                    <input required value={newCommerce.whatsapp} onChange={(e) => setNewCommerce(v => ({...v, whatsapp: e.target.value}))} placeholder="1122334455" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label className="text-sm text-slate-300">Nombre del dueño
                    <input required value={newCommerce.owner_nombre} onChange={(e) => setNewCommerce(v => ({...v, owner_nombre: e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label className="text-sm text-slate-300">Usuario OWNER
                    <input required pattern="[A-Za-z0-9]{3,40}" value={newCommerce.owner_username} onChange={(e) => setNewCommerce(v => ({...v, owner_username: e.target.value.replace(/[^a-zA-Z0-9]/g,'')}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label className="text-sm text-slate-300">Contraseña temporal
                    <input required type="password" minLength={8} value={newCommerce.owner_password} onChange={(e) => setNewCommerce(v => ({...v, owner_password: e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label className="text-sm text-slate-300">Días de prueba
                    <input required type="number" min={0} max={90} value={newCommerce.trial_days} onChange={(e) => setNewCommerce(v => ({...v, trial_days: Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-emerald-500" />
                  </label>
                </div>

                <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">La contraseña es temporal: entregala al cliente por un canal seguro y pedile que la cambie.</div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNewCommerce(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800">Cancelar</button>
                  <button disabled={creatingCommerce} className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{creatingCommerce ? 'Creando...' : 'Crear comercio'}</button>
                </div>
              </form>
            </div>
          )}

          {section === 'estadisticas' && (
            <div className="space-y-6">
              {/* Estado de comercios */}
              <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
                <h3 className="mb-5 text-xl font-bold">Estado de comercios</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
                  <StatCard title="Total" value={String(stats.total)} color="text-white" />
                  <StatCard title="Trial" value={String(stats.trials)} color="text-violet-400" />
                  <StatCard title="Activos" value={String(stats.activos)} color="text-emerald-400" />
                  <StatCard title="Por vencer" value={String(stats.porVencer)} color="text-yellow-400" />
                  <StatCard title="En gracia" value={String(stats.enGracia)} color="text-orange-400" />
                  <StatCard title="Solo desc." value={String(stats.soloDescarga)} color="text-blue-400" />
                  <StatCard title="Vencidos" value={String(stats.vencidos)} color="text-red-400" />
                </div>
              </div>

              {/* Ingresos mensuales */}
              <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
                <h3 className="mb-1 text-xl font-bold">Ingresos mensuales</h3>
                <p className="mb-5 text-sm text-slate-400">Comercios activos y por vencer — excluye trial, en gracia y vencidos</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard title="MRR Bruto" value={`$${stats.ingresosMensuales.toLocaleString('es-AR')}`} color="text-purple-400" />
                  <StatCard title="Comisiones" value={`$${stats.comisionesMensuales.toLocaleString('es-AR')}`} color="text-orange-400" />
                  <StatCard title="Neto Trikode" value={`$${stats.netoMensual.toLocaleString('es-AR')}`} color="text-emerald-400" />
                  <StatCard title="Ticket promedio" value={stats.ticketPromedio > 0 ? `$${stats.ticketPromedio.toLocaleString('es-AR')}` : '—'} color="text-cyan-400" />
                </div>
              </div>

              {/* Pipeline de conversión */}
              <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
                <h3 className="mb-5 text-xl font-bold">Pipeline de conversión</h3>
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard title="Trials activos" value={String(stats.trials)} color="text-violet-400" />
                  <StatCard title="Trial vence ≤3 días" value={String(stats.trialsUrgentes)} color="text-orange-400" />
                  <StatCard title="Tasa de conversión" value={`${stats.conversionRate}%`} color="text-emerald-400" />
                </div>
                {stats.total > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-400">Registrados ({stats.total})</span>
                      <span className="font-semibold text-emerald-300">
                        {stats.activos + stats.porVencer} activos pagos
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500 transition-all duration-700"
                        style={{ width: `${Math.max(stats.conversionRate, stats.total > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {stats.conversionRate}% de los comercios registrados están activos y pagando
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'notificaciones' && (
            <div className="space-y-4">
              {/* Sub-tabs */}
              <div className="flex gap-2 rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur-md">
                {(['alertas', 'historial'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setNotifTab(tab)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
                      notifTab === tab ? 'bg-[#98ce4f] text-[#0b1730]' : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {tab === 'alertas'
                      ? `Alertas${totalAlertas > 0 ? ` (${totalAlertas})` : ''}`
                      : 'Historial de emails'}
                  </button>
                ))}
              </div>

              {/* Tab: Alertas */}
              {notifTab === 'alertas' && (
                <div className="space-y-4">
                  {totalAlertas === 0 && (
                    <div className="rounded-xl border border-white/20 bg-white/10 p-8 text-center backdrop-blur-md">
                      <p className="text-2xl">✅</p>
                      <p className="mt-2 font-semibold">Sin alertas pendientes</p>
                      <p className="mt-1 text-sm text-slate-400">Todos los comercios están al día.</p>
                    </div>
                  )}

                  {alertas.trialsUrgentes.length > 0 && (
                    <AlertGroup
                      icon="⏳"
                      title="Trial por vencer (≤3 días)"
                      border="border-orange-500/50"
                      items={alertas.trialsUrgentes}
                      renderExtra={(c) => {
                        const due = new Date(c.fecha_vencimiento)
                        const days = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        return `Vence ${days <= 0 ? 'hoy' : `en ${days} día${days !== 1 ? 's' : ''}`}`
                      }}
                    />
                  )}

                  {alertas.ownerPendiente.length > 0 && (
                    <AlertGroup
                      icon="👤"
                      title="Owner sin activar"
                      border="border-yellow-500/50"
                      items={alertas.ownerPendiente}
                      renderExtra={(c) => c.owner_activation_label || 'Revisar activación'}
                    />
                  )}

                  {alertas.enGracia.length > 0 && (
                    <AlertGroup
                      icon="⚠️"
                      title="En período de gracia"
                      border="border-amber-500/50"
                      items={alertas.enGracia}
                      renderExtra={(c) => `${c.dias_transcurridos} día${c.dias_transcurridos !== 1 ? 's' : ''} vencido`}
                    />
                  )}

                  {alertas.soloDescarga.length > 0 && (
                    <AlertGroup
                      icon="📥"
                      title="Solo descarga"
                      border="border-blue-500/50"
                      items={alertas.soloDescarga}
                      renderExtra={(c) => `${c.dias_transcurridos} día${c.dias_transcurridos !== 1 ? 's' : ''} vencido`}
                    />
                  )}

                  {alertas.vencidos.length > 0 && (
                    <AlertGroup
                      icon="❌"
                      title="Vencidos"
                      border="border-red-500/50"
                      items={alertas.vencidos}
                      renderExtra={(c) => `${c.dias_transcurridos} día${c.dias_transcurridos !== 1 ? 's' : ''} vencido`}
                    />
                  )}
                </div>
              )}

              {/* Tab: Historial */}
              {notifTab === 'historial' && (
                <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md">
                  {loadingNotifs ? (
                    <div className="p-8 text-center text-slate-400">Cargando historial...</div>
                  ) : notifLogs.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-2xl">📧</p>
                      <p className="mt-2 font-semibold">Sin registros</p>
                      <p className="mt-1 text-sm text-slate-400">No hay emails registrados todavía.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                            <th className="p-4 text-left">Fecha</th>
                            <th className="p-4 text-left">Comercio</th>
                            <th className="p-4 text-left">Tipo</th>
                            <th className="p-4 text-left">Motivo</th>
                            <th className="p-4 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {notifLogs.map((log) => (
                            <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="p-4 text-slate-400 whitespace-nowrap">
                                {new Date(log.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-4 font-medium">{log.nombre_comercio || '—'}</td>
                              <td className="p-4">
                                <span className="rounded bg-slate-700 px-2 py-0.5 text-xs">{log.tipo || '—'}</span>
                              </td>
                              <td className="p-4 text-slate-300">{MOTIVO_LABELS[log.motivo || ''] || log.motivo || '—'}</td>
                              <td className="p-4 text-center">
                                {log.enviado === true ? (
                                  <span title="Enviado" className="text-emerald-400">✓</span>
                                ) : log.enviado === false ? (
                                  <span title={log.error_message || 'Error'} className="cursor-help text-red-400">✗</span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {section === 'configuracion' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
                <h3 className="mb-3 text-lg font-semibold">Alta o reingreso de código comercial</h3>
                <p className="mb-4 text-xs text-slate-400">
                  Tipos disponibles: AV, CT, DU.
                </p>

                <form onSubmit={createSalesAgent} className="space-y-3">
                  <input
                    value={nombreVendedor}
                    onChange={(e) => setNombreVendedor(e.target.value)}
                    placeholder="Nombre del vendedor"
                    className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2"
                  />

                  <select
                    value={tipoCodigo}
                    onChange={(e) => setTipoCodigo(e.target.value as 'AV' | 'CT' | 'DU')}
                    className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2"
                  >
                    <option value="AV">AV - Vendedor</option>
                    <option value="CT">CT - Cuerpo Técnico</option>
                    <option value="DU">DU - Dueño</option>
                  </select>

                  <input
                    value={whatsappVendedor}
                    onChange={(e) => setWhatsappVendedor(e.target.value)}
                    placeholder="WhatsApp (opcional)"
                    className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2"
                  />

                  <input
                    value={emailVendedor}
                    onChange={(e) => setEmailVendedor(e.target.value)}
                    placeholder="Email (opcional)"
                    className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2"
                  />

                  <button
                    type="submit"
                    disabled={guardandoVendedor}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-60"
                  >
                    {guardandoVendedor ? 'Guardando...' : 'Crear código'}
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
                <h3 className="mb-3 text-lg font-semibold">Vendedores registrados</h3>

                {salesStatus && (
                  <div className="mb-3 rounded border border-cyan-500/40 bg-cyan-900/20 p-3 text-xs text-cyan-200">
                    {salesStatus}
                  </div>
                )}

                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="p-2">Nombre</th>
                        <th className="p-2">Código</th>
                        <th className="p-2">Estado</th>
                        <th className="p-2">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesAgents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-3 text-center text-slate-400">Sin códigos registrados.</td>
                        </tr>
                      ) : (
                        salesAgents.map((agent) => (
                          <tr key={agent.id} className="border-b border-slate-800/70">
                            <td className="p-2">
                              <div className="font-semibold">{agent.nombre}</div>
                              <div className="text-xs text-slate-400">{agent.email || ''}</div>
                            </td>
                            <td className="p-2">
                              <span className="rounded bg-white/10 px-2 py-1 text-xs">{agent.ref_code || '-'}</span>
                            </td>
                            <td className="p-2">
                              <span className={`text-xs ${agent.status === 'active' ? 'text-green-300' : 'text-slate-400'}`}>
                                {agent.status === 'active' ? 'Activo' : `Inactivo${agent.inactive_from ? ` (${new Date(agent.inactive_from).toLocaleDateString('es-AR')})` : ''}`}
                              </span>
                            </td>
                            <td className="p-2">
                              {agent.status === 'active' ? (
                                <button
                                  onClick={() => void deactivateSalesAgent(agent.id)}
                                  className="rounded border border-white/20 bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
                                >
                                  Baja
                                </button>
                              ) : (
                                <span className="text-xs text-slate-500">Sin acciones</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/20 bg-white/10 p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-slate-400">{title}</div>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    Trial: 'bg-violet-600',
    Activo: 'bg-emerald-600',
    'Por vencer': 'bg-amber-500',
    'En gracia': 'bg-orange-500',
    'Solo descarga': 'bg-blue-500',
    Vencido: 'bg-red-600',
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${styles[estado] ?? 'bg-slate-500'}`}>
      {estado}
    </span>
  )
}


function exportCsv(clientes: Cliente[]) {
  const csvContent = [
    ['Comercio', 'Rubro', 'Vendedor', 'Codigo Vendedor', 'Plan', 'WhatsApp', 'Email', 'Estado', 'Dias', 'Vencimiento', 'Precio Mensual', 'Comision Vendedor', 'Neto Trikode'],
    ...clientes.map((c) => [
      c.nombre_comercio,
      c.rubro,
      c.vendedor_nombre || '',
      c.vendedor_codigo || '',
      'SIDEA Completo',
      c.whatsapp,
      c.email || '',
      c.estado,
      String(c.dias_transcurridos),
      new Date(c.fecha_vencimiento).toLocaleDateString('es-AR'),
      `$${(Number(c.precio_mensual) || 0).toLocaleString('es-AR')}`,
      `$${(Number(c.comision_mensual) || 0).toLocaleString('es-AR')}`,
      `$${(Number(c.ingreso_neto_mensual) || 0).toLocaleString('es-AR')}`,
    ])]
    .map((row) => row.join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `clientes_trikode_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

// Mapa de motivos técnicos a etiquetas legibles para el historial de emails
const MOTIVO_LABELS: Record<string, string> = {
  OWNER_ACTIVACION: 'Invitación owner',
  BIENVENIDA_TRIAL: 'Bienvenida trial',
  PAGO_CONFIRMADO: 'Pago confirmado',
  RENOVACION: 'Renovación',
  VENCIMIENTO: 'Aviso de vencimiento',
  TRIAL_VENCIDO: 'Trial vencido',
  TRIAL_URGENTE: 'Trial por vencer',
  GRACIA: 'Período de gracia',
  BAJA: 'Confirmación de baja',
}

// Componente de grupo de alertas reutilizable
function AlertGroup({
  icon,
  title,
  border,
  items,
  renderExtra,
}: {
  icon: string
  title: string
  border: string
  items: Array<{
    id: string
    nombre_comercio: string
    whatsapp: string
    email?: string | null
    estado: string
    fecha_vencimiento: string
    dias_transcurridos: number
    owner_activation_label?: string | null
  }>
  renderExtra: (c: typeof items[number]) => string
}) {
  return (
    <div className={`rounded-xl border bg-white/10 p-5 backdrop-blur-md ${border}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h4 className="font-semibold">{title}</h4>
        <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 10).map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm"
          >
            <span className="font-medium">{c.nombre_comercio}</span>
            <span className="text-slate-400">{c.email || c.whatsapp}</span>
            <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-xs text-slate-300">
              {renderExtra(c)}
            </span>
          </div>
        ))}
        {items.length > 10 && (
          <p className="pt-1 text-xs text-slate-400">…y {items.length - 10} más</p>
        )}
      </div>
    </div>
  )
}
