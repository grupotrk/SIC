'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type SubscriptionComputed } from '@/lib/subscriptionLifecycle'
import { createSyncId, isProbablyNetworkError, type PendingSale } from '@/hooks/useOfflineSync'
import { type UserRole, type Turno } from '@/types'

interface Producto {
  id: string
  nombre: string
  marca?: string
  categoria?: string
  precio_venta: number
  stock_actual: number
  unidad_medida?: string
  permite_fraccion?: boolean
}

interface CartItem extends Producto {
  quantity: number
}

const FRACTION_STEP = 0.25

function getStepValue(item: Producto | CartItem): number {
  return item.permite_fraccion ? FRACTION_STEP : 1
}

function formatQuantity(item: CartItem): string {
  return item.permite_fraccion ? item.quantity.toFixed(3) : item.quantity.toString()
}

interface PointOfSaleProps {
  userRole: UserRole | null
  turnoActivo: Turno | null
  subscription: SubscriptionComputed | null
  isOnline: boolean
  enqueueOfflineSale: (sale: PendingSale) => void
  persistSaleOnline: (sale: PendingSale) => Promise<void>
  onGoToClose: () => void
}

export default function PointOfSale({
  userRole,
  turnoActivo,
  subscription,
  isOnline,
  enqueueOfflineSale,
  persistSaleOnline,
  onGoToClose,
}: PointOfSaleProps) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todos')
  
  const [stockProductId, setStockProductId] = useState('')
  const [stockCantidad, setStockCantidad] = useState('')
  const [addingStock, setAddingStock] = useState(false)
  
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)

  const puedeAgregarStock = userRole?.metadata?.puede_agregar_stock === true

  useEffect(() => {
    loadProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProductos = async () => {
    if (!userRole) return
    try {
      const { data, error } = await supabase
        .from('productos_tienda')
        .select('id,nombre,marca,categoria,precio_venta,stock_actual,unidad_medida,permite_fraccion')
        .eq('tenant_id', userRole.tenantId)
        .eq('activo', true)
        .order('nombre', { ascending: true })

      if (!error && data) {
        setProductos(data as Producto[])
      }
    } catch {
      // no-op
    }
  }

  // Escuchar si hubo una recarga solicitada desde afuera (por ejemplo un sync)
  // Como `loadProductos` está aquí, la forma más limpia en un Smart Component
  // es escuchar un evento custom de window, o simplemente no hacerlo y que se refresque manual/periódico.
  // Agregaremos un listener para 'sic:reload_productos'
  useEffect(() => {
    const handleReload = () => loadProductos()
    window.addEventListener('sic:reload_productos', handleReload)
    return () => window.removeEventListener('sic:reload_productos', handleReload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const completarVenta = async (metodoPago: string) => {
    if (subscription?.accessMode !== 'FULL') {
      setMensaje({ tipo: 'error', texto: 'Cuenta suspendida. No es posible registrar ventas en este estado.' })
      return
    }

    if (cart.length === 0 || !userRole || !turnoActivo) {
      setMensaje({ tipo: 'error', texto: 'Error en la venta' })
      return
    }

    const total = cart.reduce((sum, item) => sum + item.precio_venta * item.quantity, 0)

    const stockInsuficiente = cart.find((item) => item.quantity > item.stock_actual)
    if (stockInsuficiente) {
      setMensaje({ tipo: 'error', texto: `Stock insuficiente para ${stockInsuficiente.nombre}.` })
      return
    }

    const pendingSale: PendingSale = {
      syncId: createSyncId(),
      tenantId: userRole.tenantId,
      comercioUsuarioId: userRole.id,
      turnoId: turnoActivo.id,
      metodoPago,
      total,
      createdAt: new Date().toISOString(),
      items: cart.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        precio_venta: item.precio_venta,
        quantity: item.quantity,
      })),
    }

    if (!isOnline) {
      enqueueOfflineSale(pendingSale)
      setCart([])
      setMensaje({ tipo: 'success', texto: 'Sin internet: venta guardada offline. Se sincronizara automaticamente.' })
      setTimeout(() => setMensaje(null), 3500)
      return
    }

    try {
      await persistSaleOnline(pendingSale)

      setCart([])
      await loadProductos()
      setMensaje({ tipo: 'success', texto: 'Venta registrada' })
      setTimeout(() => setMensaje(null), 3000)
    } catch (error) {
      if (isProbablyNetworkError(error)) {
        enqueueOfflineSale(pendingSale)
        setCart([])
        setMensaje({ tipo: 'success', texto: 'Internet inestable: venta guardada offline para sincronizar.' })
        setTimeout(() => setMensaje(null), 3500)
      } else {
        setMensaje({ tipo: 'error', texto: 'Error al registrar venta' })
      }
    }
  }

  const agregarStock = async () => {
    if (!stockProductId || !stockCantidad) {
      setMensaje({ tipo: 'error', texto: 'Seleccioná un producto e ingresá la cantidad.' })
      return
    }
    const cant = parseFloat(stockCantidad)
    if (Number.isNaN(cant) || cant <= 0) {
      setMensaje({ tipo: 'error', texto: 'La cantidad debe ser mayor a cero.' })
      return
    }
    setAddingStock(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMensaje({ tipo: 'error', texto: 'Sesión expirada.' })
        return
      }
      const res = await fetch('/api/employee/add-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ productoId: stockProductId, cantidad: cant }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.ok) {
        setMensaje({ tipo: 'error', texto: payload.error ?? 'No se pudo agregar el stock.' })
        return
      }
      setMensaje({ tipo: 'success', texto: payload.mensaje ?? 'Stock actualizado.' })
      setStockProductId('')
      setStockCantidad('')
      await loadProductos()
      setTimeout(() => setMensaje(null), 3500)
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al agregar stock.' })
    } finally {
      setAddingStock(false)
    }
  }

  const categoriasFiltro = ['Todos', ...Array.from(new Set(productos.map(p => p.categoria ?? 'General'))).sort()]

  const productosFiltrados = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCat = categoriaFiltro === 'Todos' || (p.categoria ?? 'General') === categoriaFiltro
    return matchSearch && matchCat
  })

  return (
    <>
      {mensaje && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            mensaje.tipo === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── CATÁLOGO ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-800">Catálogo</h2>
            <span className="text-xs text-slate-400">{productos.filter(p => p.stock_actual > 0).length} con stock</span>
          </div>

          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setCategoriaFiltro('Todos') }}
            className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          />

          {categoriasFiltro.length > 2 && (
            <div className="mb-3 flex gap-1.5 flex-wrap">
              {categoriasFiltro.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${categoriaFiltro === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {productosFiltrados.map(producto => {
              const enCarrito = cart.find(c => c.id === producto.id)
              const sinStock = producto.stock_actual <= 0
              return (
                <button
                  key={producto.id}
                  onClick={() => {
                    if (sinStock) return
                    const step = getStepValue(producto)
                    const existing = cart.find(c => c.id === producto.id)
                    if (existing) {
                      setCart(cart.map(c => c.id === producto.id
                        ? { ...c, quantity: parseFloat(Math.min(c.stock_actual, c.quantity + step).toFixed(3)) }
                        : c
                      ))
                    } else {
                      setCart([...cart, { ...producto, quantity: step }])
                    }
                  }}
                  className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition ${
                    sinStock
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50'
                      : enCarrito
                      ? 'border-emerald-300 bg-emerald-50 shadow-sm ring-1 ring-emerald-300'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {enCarrito && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                      {formatQuantity(enCarrito)}
                    </span>
                  )}
                  <span className="text-sm font-semibold leading-tight text-slate-900 pr-6">{producto.nombre}{producto.marca ? <span className="font-normal text-slate-400"> · {producto.marca}</span> : null}</span>
                  <span className="mt-1 text-base font-black text-slate-800">
                    ${producto.precio_venta.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    {producto.permite_fraccion && <span className="text-xs font-normal text-slate-500">/{producto.unidad_medida}</span>}
                  </span>
                  <span className={`mt-1 text-xs font-medium ${producto.stock_actual <= 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    Stock: {producto.permite_fraccion ? producto.stock_actual.toFixed(2) : producto.stock_actual} {producto.unidad_medida}
                  </span>
                </button>
              )
            })}
            {productosFiltrados.length === 0 && (
              <p className="col-span-3 py-8 text-center text-sm text-slate-400">Sin resultados</p>
            )}
          </div>
        </div>

        {/* ── CARRITO ──────────────────────────────────────────── */}
        <div className="w-full lg:w-72 lg:shrink-0">
          <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-bold text-slate-800">
              Carrito
              {cart.length > 0 && <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">{cart.length}</span>}
            </h3>

            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Tocá un producto para agregarlo</p>
            ) : (
              <div className="mb-3 space-y-1.5 max-h-72 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">{item.nombre}</p>
                      <p className="text-xs text-slate-500">${(item.precio_venta * item.quantity).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <input
                      type="number"
                      min={getStepValue(item)}
                      step={getStepValue(item)}
                      value={item.quantity}
                      onChange={e => {
                        const next = parseFloat(e.target.value)
                        if (Number.isNaN(next) || next <= 0) {
                          setCart(cart.filter(c => c.id !== item.id))
                          return
                        }
                        setCart(cart.map(c => c.id === item.id ? { ...c, quantity: parseFloat(next.toFixed(3)) } : c))
                      }}
                      className="w-16 rounded border border-slate-200 bg-white text-black text-center text-xs focus:outline-none focus:border-blue-400"
                    />
                    <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-red-400 hover:text-red-600" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg></button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-slate-600">Total</span>
                <span className="text-xl font-black text-slate-900">
                  ${cart.reduce((sum, item) => sum + item.precio_venta * item.quantity, 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'EFECTIVO', label: 'Efectivo', icon: '💵' },
                  { value: 'TARJETA', label: 'Tarjeta', icon: '💳' },
                  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: '⇄' },
                  { value: 'BILLETERA', label: 'Billetera', icon: '◉' },
                  { value: 'QR', label: 'QR', icon: '▦' },
                ].map((medio) => (
                  <button
                    key={medio.value}
                    onClick={() => completarVenta(medio.value)}
                    disabled={cart.length === 0 || subscription?.accessMode !== 'FULL'}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-40 ${
                      medio.value === 'EFECTIVO'
                        ? 'col-span-2 border-slate-800 bg-slate-900 text-white hover:bg-slate-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="mr-1.5" aria-hidden>{medio.icon}</span>{medio.label}
                  </button>
                ))}
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="col-span-2 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-200">
                    Vaciar carrito
                  </button>
                )}
              </div>

              <button
                onClick={onGoToClose}
                className="mt-3 w-full rounded-xl border border-orange-200 bg-orange-50 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition"
              >
                Cerrar Turno
              </button>
            </div>
          </div>
        </div>
      </div>

      {puedeAgregarStock && (
        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="mb-1 text-base font-bold text-sky-900">Agregar Stock</h3>
          <p className="mb-4 text-xs text-sky-700">Incrementa el stock de un producto existente del catálogo.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Producto</label>
              <select
                value={stockProductId}
                onChange={(e) => setStockProductId(e.target.value)}
                className="w-full rounded-lg border border-sky-200 bg-white p-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="">-- Seleccioná un producto --</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (stock actual: {p.stock_actual.toFixed(p.permite_fraccion ? 3 : 0)} {p.unidad_medida ?? 'UNIDAD'})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-32">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Cantidad a sumar</label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                placeholder="Ej: 10"
                value={stockCantidad}
                onChange={(e) => setStockCantidad(e.target.value)}
                className="w-full rounded-lg border border-sky-200 bg-white p-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <button
              onClick={agregarStock}
              disabled={addingStock || !stockProductId || !stockCantidad}
              className="rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
            >
              {addingStock ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
