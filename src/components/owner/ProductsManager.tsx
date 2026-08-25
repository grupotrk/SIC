'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Producto = {
  id: string
  nombre: string
  marca: string
  categoria: string
  unidad_medida: string
  precio_costo: number | null
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  permite_fraccion: boolean
  activo: boolean
  codigo_barras: string | null
  observaciones: string | null
}

type CatalogoPreview = {
  catalogoNombre: string
  totalProductos: number
  yaConProductos: boolean
  productosExistentes: number
}

export default function ProductsManager() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null)
  const [productForm, setProductForm] = useState({
    nombre: '',
    marca: '',
    categoria: 'General',
    unidad_medida: 'unidad',
    precio_venta: '',
    precio_costo: '',
    stock_actual: '0',
    stock_minimo: '0',
    permite_fraccion: false,
    codigo_barras: '',
    observaciones: '',
  })
  const [savingProduct, setSavingProduct] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null)
  const [productTab, setProductTab] = useState<'activos' | 'inactivos'>('activos')
  const [editInline, setEditInline] = useState<{ id: string; campo: 'precio_venta' | 'stock_actual'; valor: string } | null>(null)
  const [savingInline, setSavingInline] = useState(false)
  const [addStockInline, setAddStockInline] = useState<{ id: string; valor: string; stockActual: number; unidad: string } | null>(null)
  const [savingAddStock, setSavingAddStock] = useState(false)
  const [precioCalcRef, setPrecioCalcRef] = useState('250g')
  const [precioCalcInput, setPrecioCalcInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [catalogoPreview, setCatalogoPreview] = useState<CatalogoPreview | null>(null)
  const [catalogoPreviewLoading, setCatalogoPreviewLoading] = useState(false)
  const [importandoCatalogo, setImportandoCatalogo] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null)

  useEffect(() => {
    loadProductos()
    loadCatalogoPreview()
  }, [])

  const loadProductos = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/owner/products', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const payload = await res.json() as { success: boolean; products?: Producto[] }
      if (payload.success && payload.products) setProductos(payload.products)
    } catch { /* no bloquea */ }
  }

  const loadCatalogoPreview = async () => {
    setCatalogoPreviewLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/owner/import-catalog', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const payload = await res.json() as { success: boolean } & Partial<CatalogoPreview>
      if (payload.success) {
        setCatalogoPreview({
          catalogoNombre: payload.catalogoNombre ?? '',
          totalProductos: payload.totalProductos ?? 0,
          yaConProductos: payload.yaConProductos ?? false,
          productosExistentes: payload.productosExistentes ?? 0,
        })
      }
    } catch { /* no bloquea */ }
    finally { setCatalogoPreviewLoading(false) }
  }

  const importarCatalogo = async (forzar = false) => {
    if (!forzar && catalogoPreview?.yaConProductos) {
      if (!confirm(`Tu catálogo ya tiene ${catalogoPreview.productosExistentes} productos. ¿Agregar el catálogo base igual?`)) return
      forzar = true
    }
    setImportandoCatalogo(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sin sesión')
      const res = await fetch(`/api/owner/import-catalog${forzar ? '?forzar=true' : ''}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const payload = await res.json() as { success: boolean; insertados?: number; mensaje?: string; error?: string }
      if (!res.ok || !payload.success) {
        setMensaje({ tipo: 'error', texto: payload.mensaje ?? 'No se pudo importar el catálogo.' })
        return
      }
      setMensaje({ tipo: 'success', texto: payload.mensaje ?? `${payload.insertados} productos importados.` })
      setCatalogoPreview(null)
      await loadProductos()
      setTimeout(() => setMensaje(null), 4000)
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al importar el catálogo.' })
    } finally {
      setImportandoCatalogo(false)
    }
  }

  const openNewProduct = () => {
    setEditingProduct(null)
    setProductForm({ nombre: '', marca: '', categoria: 'General', unidad_medida: 'unidad', precio_venta: '', precio_costo: '', stock_actual: '0', stock_minimo: '0', permite_fraccion: false, codigo_barras: '', observaciones: '' })
    setPrecioCalcRef('250g')
    setPrecioCalcInput('')
    setShowProductForm(true)
  }

  const openEditProduct = (p: Producto) => {
    setEditingProduct(p)
    setProductForm({ nombre: p.nombre, marca: p.marca, categoria: p.categoria, unidad_medida: p.unidad_medida, precio_venta: String(p.precio_venta), precio_costo: p.precio_costo ? String(p.precio_costo) : '', stock_actual: String(p.stock_actual), stock_minimo: String(p.stock_minimo), permite_fraccion: p.permite_fraccion, codigo_barras: p.codigo_barras ?? '', observaciones: p.observaciones ?? '' })
    const isLiq = ['lt','litros','litro','ml','cc'].some(x => p.unidad_medida.toLowerCase().includes(x))
    setPrecioCalcRef(isLiq ? '500ml' : '250g')
    setPrecioCalcInput('')
    setShowProductForm(true)
  }

  const saveProduct = async () => {
    if (!productForm.nombre.trim() || !productForm.precio_venta) {
      setMensaje({ tipo: 'error', texto: 'Nombre y precio de venta son obligatorios.' })
      return
    }
    setSavingProduct(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sin sesión')
      const method = editingProduct ? 'PATCH' : 'POST'
      const body = { ...productForm, ...(editingProduct ? { id: editingProduct.id } : {}) }
      const res = await fetch('/api/owner/products', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setMensaje({ tipo: 'success', texto: editingProduct ? 'Producto actualizado.' : 'Producto creado.' })
      setShowProductForm(false)
      loadProductos()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el producto.' })
    } finally {
      setSavingProduct(false)
    }
  }

  const desactivarProducto = async (id: string) => {
    if (!confirm('¿Desactivar este producto?')) return
    setDeletingProduct(id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sin sesión')
      const res = await fetch(`/api/owner/products?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error()
      setMensaje({ tipo: 'success', texto: 'Producto desactivado.' })
      loadProductos()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo desactivar el producto.' })
    } finally {
      setDeletingProduct(null)
    }
  }

  const saveInlineEdit = async () => {
    if (!editInline) return
    setSavingInline(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error()
      const res = await fetch('/api/owner/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: editInline.id, [editInline.campo]: parseFloat(editInline.valor) }),
      })
      if (!res.ok) throw new Error()
      setEditInline(null)
      await loadProductos()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el cambio.' })
    } finally {
      setSavingInline(false)
    }
  }

  const saveAddStock = async () => {
    if (!addStockInline) return
    const delta = parseFloat(addStockInline.valor)
    if (isNaN(delta) || delta === 0) { setAddStockInline(null); return }
    setSavingAddStock(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error()
      const nuevoStock = addStockInline.stockActual + delta
      const res = await fetch('/api/owner/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: addStockInline.id, stock_actual: nuevoStock }),
      })
      if (!res.ok) throw new Error()
      setAddStockInline(null)
      await loadProductos()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo actualizar el stock.' })
    } finally {
      setSavingAddStock(false)
    }
  }

  const productosFiltrados = productos.filter(p => {
    if (p.activo !== (productTab === 'activos')) return false

    if (!searchQuery.trim()) return true

    const term = searchQuery.toLowerCase()
    return p.nombre.toLowerCase().includes(term) ||
           (p.marca && p.marca.toLowerCase().includes(term)) ||
           (p.codigo_barras && p.codigo_barras.toLowerCase().includes(term))
  })

  return (
    <div className="mb-6">
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

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-slate-900">Catálogo de Productos</h2>
        <button onClick={openNewProduct} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition">+ Nuevo producto</button>
      </div>

      {/* Banner de importación de catálogo base */}
      {!catalogoPreviewLoading && catalogoPreview && !catalogoPreview.yaConProductos && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <p className="font-semibold text-emerald-900">¡Tenemos un catálogo base para {catalogoPreview.catalogoNombre}!</p>
            <p className="mt-0.5 text-sm text-emerald-700">
              {catalogoPreview.totalProductos} productos listos para importar. Podés editarlos después.
            </p>
          </div>
          <button
            onClick={() => importarCatalogo(false)}
            disabled={importandoCatalogo}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {importandoCatalogo ? 'Importando...' : `Importar catálogo (${catalogoPreview.totalProductos})`}
          </button>
        </div>
      )}

      {/* Search y Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <div className="flex gap-2">
          {(['activos', 'inactivos'] as const).map(tab => (
            <button key={tab} onClick={() => { setProductTab(tab); setSearchQuery(''); }} className={`px-3 py-1 rounded-full text-xs font-semibold transition ${productTab === tab ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {tab === 'activos' ? `Activos (${productos.filter(p => p.activo).length})` : `Inactivos (${productos.filter(p => !p.activo).length})`}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" /></svg>
          </div>
          <input
            type="text"
            placeholder={productTab === 'activos' ? "Buscar en catálogo activo..." : "Buscar producto en catálogo base (ej: Coca Cola)..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>
      </div>

      {/* Formulario inline */}
      {showProductForm && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="rounded border border-slate-300 p-2 text-sm" placeholder="Nombre *" value={productForm.nombre} onChange={e => setProductForm(f => ({ ...f, nombre: e.target.value }))} />
            <input className="rounded border border-slate-300 p-2 text-sm" placeholder="Marca" value={productForm.marca} onChange={e => setProductForm(f => ({ ...f, marca: e.target.value }))} />
            <input className="rounded border border-slate-300 p-2 text-sm" placeholder="Categoría" value={productForm.categoria} onChange={e => setProductForm(f => ({ ...f, categoria: e.target.value }))} />
            <input
              className="rounded border border-slate-300 p-2 text-sm"
              placeholder="Unidad (unidad, kg, lt...)"
              value={productForm.unidad_medida}
              onChange={e => {
                const u = e.target.value
                const isLiq = ['lt','litros','litro','ml','cc'].some(x => u.toLowerCase().includes(x))
                setPrecioCalcRef(isLiq ? '500ml' : '250g')
                setPrecioCalcInput('')
                setProductForm(f => ({ ...f, unidad_medida: u }))
              }}
            />
            <input
              className="rounded border border-slate-300 p-2 text-sm"
              placeholder={`Precio ${productForm.permite_fraccion ? `por ${productForm.unidad_medida || 'kg'}` : 'venta'} *`}
              type="number" min="0" step="0.01"
              value={productForm.precio_venta}
              onChange={e => { setProductForm(f => ({ ...f, precio_venta: e.target.value })); setPrecioCalcInput('') }}
            />
            <input className="rounded border border-slate-300 p-2 text-sm" placeholder="Precio costo" type="number" min="0" step="0.01" value={productForm.precio_costo} onChange={e => setProductForm(f => ({ ...f, precio_costo: e.target.value }))} />
            <input className="rounded border border-slate-300 p-2 text-sm" placeholder="Stock inicial" type="number" min="0" step="0.001" value={productForm.stock_actual} onChange={e => setProductForm(f => ({ ...f, stock_actual: e.target.value }))} />
            <input className="rounded border border-slate-300 p-2 text-sm" placeholder="Stock mínimo" type="number" min="0" step="0.001" value={productForm.stock_minimo} onChange={e => setProductForm(f => ({ ...f, stock_minimo: e.target.value }))} />
            <input className="rounded border border-slate-300 p-2 text-sm" placeholder="Código de barras" value={productForm.codigo_barras} onChange={e => setProductForm(f => ({ ...f, codigo_barras: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.permite_fraccion}
                onChange={e => {
                  const checked = e.target.checked
                  const isLiq = ['lt','litros','litro','ml','cc'].some(x => productForm.unidad_medida.toLowerCase().includes(x))
                  setPrecioCalcRef(isLiq ? '500ml' : '250g')
                  setPrecioCalcInput('')
                  setProductForm(f => ({ ...f, permite_fraccion: checked }))
                }}
              />
              Permite fracción (kg, lt...)
            </label>
          </div>
          {/* Calculadora de precio por fracción — solo cuando permite_fraccion está activo */}
          {productForm.permite_fraccion && (() => {
            const isLiq = ['lt','litros','litro','ml','cc'].some(x => productForm.unidad_medida.toLowerCase().includes(x))
            const base = parseFloat(productForm.precio_venta)
            const opts = isLiq
              ? [{ key: '100ml', label: '100 ml', mult: 10 }, { key: '500ml', label: '500 ml', mult: 2 }, { key: '1lt', label: '1 lt', mult: 1 }]
              : [{ key: '100g', label: '100 g', mult: 10 }, { key: '250g', label: '250 g', mult: 4 }, { key: '500g', label: '500 g', mult: 2 }, { key: '1kg', label: '1 kg', mult: 1 }]
            const baseUnit = isLiq ? 'lt' : (productForm.unidad_medida || 'kg')
            return (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-800">Calculadora de precio por fracción</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-blue-700">Si cobrás</span>
                  <input
                    className="w-24 rounded border border-blue-200 bg-white p-1.5 text-sm text-right"
                    placeholder="$ precio"
                    type="number" min="0" step="0.01"
                    value={precioCalcInput}
                    onChange={e => {
                      setPrecioCalcInput(e.target.value)
                      const mult = opts.find(o => o.key === precioCalcRef)?.mult ?? 1
                      const calc = parseFloat(e.target.value) * mult
                      if (!isNaN(calc) && calc > 0) setProductForm(f => ({ ...f, precio_venta: String(calc) }))
                    }}
                  />
                  <span className="text-xs text-blue-700">por</span>
                  <select
                    className="rounded border border-blue-200 bg-white p-1.5 text-xs"
                    value={precioCalcRef}
                    onChange={e => { setPrecioCalcRef(e.target.value); setPrecioCalcInput('') }}
                  >
                    {opts.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  {precioCalcInput && productForm.precio_venta && (
                    <span className="text-xs font-bold text-blue-900">→ ${parseFloat(productForm.precio_venta).toLocaleString('es-AR')}/{baseUnit}</span>
                  )}
                </div>
                {!isNaN(base) && base > 0 && (
                  <div className="flex gap-3 flex-wrap pt-1 border-t border-blue-100">
                    <span className="text-xs text-blue-600 font-medium">Cliente pagará:</span>
                    {opts.filter(o => o.mult !== 1).map(o => (
                      <span key={o.key} className="text-xs bg-white border border-blue-100 rounded px-2 py-0.5 text-blue-800">
                        {o.label}: <b>${(base / o.mult).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
          <input className="mt-2 w-full rounded border border-slate-300 p-2 text-sm" placeholder="Observaciones" value={productForm.observaciones} onChange={e => setProductForm(f => ({ ...f, observaciones: e.target.value }))} />
          <div className="mt-3 flex gap-2">
            <button onClick={saveProduct} disabled={savingProduct} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {savingProduct ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowProductForm(false)} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabla de productos */}
      {productTab === 'inactivos' && searchQuery.trim() === '' ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 h-10 w-10 text-slate-300"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" /></svg>
          <p className="font-semibold text-slate-700">Catálogo base oculto por defecto</p>
          <p className="text-sm">Escribí en el buscador de arriba para encontrar productos específicos y activarlos.</p>
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          <p>No se encontraron productos para &quot;{searchQuery}&quot;.</p>
          {productTab === 'inactivos' && (
            <button onClick={openNewProduct} className="mt-3 font-semibold text-emerald-600 hover:text-emerald-700 underline">
              Crear producto nuevo
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Nombre</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Categoría</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Precio</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Stock</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {productosFiltrados.map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {p.nombre}
                    {p.marca && <span className="ml-1 text-xs text-slate-400">{p.marca}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{p.categoria}</td>
                  <td className="px-3 py-2 text-right">
                    {editInline?.id === p.id && editInline?.campo === 'precio_venta' ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          autoFocus
                          className="w-24 rounded border border-emerald-400 p-1 text-sm text-right"
                          type="number" min="0" step="0.01"
                          value={editInline.valor}
                          onChange={e => setEditInline(ei => ei ? { ...ei, valor: e.target.value } : null)}
                          onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditInline(null) }}
                        />
                        <button onClick={saveInlineEdit} disabled={savingInline} className="text-emerald-600 font-bold text-sm disabled:opacity-50" title="Confirmar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg></button>
                        <button onClick={() => setEditInline(null)} className="text-slate-400 text-sm" title="Cancelar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditInline({ id: p.id, campo: 'precio_venta', valor: String(p.precio_venta) })}
                        className="font-semibold text-slate-900 hover:text-blue-600 cursor-pointer text-right w-full block"
                        title="Clic para editar precio"
                      >
                        ${p.precio_venta.toFixed(2)}
                        {p.permite_fraccion && <span className="text-xs text-slate-400">/{p.unidad_medida}</span>}
                        {p.permite_fraccion && p.precio_venta > 0 && (
                          <div className="text-xs text-slate-400 font-normal">
                            {['lt','litros','litro','ml','cc'].some(x => p.unidad_medida.toLowerCase().includes(x))
                              ? `500ml≈$${(p.precio_venta * 0.5).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
                              : `250g≈$${(p.precio_venta * 0.25).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
                            }
                          </div>
                        )}
                      </button>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold ${p.stock_actual <= p.stock_minimo ? 'text-red-600' : 'text-emerald-600'}`}>
                    {addStockInline?.id === p.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs text-slate-500 mr-1">{p.stock_actual} +</span>
                        <input
                          autoFocus
                          className="w-20 rounded border border-amber-400 p-1 text-sm text-right"
                          type="number" step="0.001"
                          placeholder="cant."
                          value={addStockInline.valor}
                          onChange={e => setAddStockInline(s => s ? { ...s, valor: e.target.value } : null)}
                          onKeyDown={e => { if (e.key === 'Enter') saveAddStock(); if (e.key === 'Escape') setAddStockInline(null) }}
                        />
                        <button onClick={saveAddStock} disabled={savingAddStock} className="text-emerald-600 font-bold text-sm disabled:opacity-50" title="Confirmar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg></button>
                        <button onClick={() => setAddStockInline(null)} className="text-slate-400 text-sm" title="Cancelar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg></button>
                      </div>
                    ) : editInline?.id === p.id && editInline?.campo === 'stock_actual' ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          autoFocus
                          className="w-20 rounded border border-emerald-400 p-1 text-sm text-right"
                          type="number" min="0" step="0.001"
                          value={editInline.valor}
                          onChange={e => setEditInline(ei => ei ? { ...ei, valor: e.target.value } : null)}
                          onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditInline(null) }}
                        />
                        <button onClick={saveInlineEdit} disabled={savingInline} className="text-emerald-600 font-bold text-sm disabled:opacity-50" title="Confirmar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg></button>
                        <button onClick={() => setEditInline(null)} className="text-slate-400 text-sm" title="Cancelar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditInline({ id: p.id, campo: 'stock_actual', valor: String(p.stock_actual) })}
                          className="text-right cursor-pointer hover:opacity-70"
                          title="Clic para reemplazar stock"
                        >
                          {p.stock_actual} {p.unidad_medida}
                        </button>
                        <button
                          onClick={() => { setEditInline(null); setAddStockInline({ id: p.id, valor: '', stockActual: p.stock_actual, unidad: p.unidad_medida }) }}
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700 hover:bg-amber-200 transition"
                          title="Agregar stock (sumar)"
                        >+</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right flex gap-2 justify-end">
                    <button onClick={() => openEditProduct(p)} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">Editar</button>
                    {p.activo && (
                      <button onClick={() => desactivarProducto(p.id)} disabled={deletingProduct === p.id} className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-50">
                        {deletingProduct === p.id ? '...' : 'Desactivar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
