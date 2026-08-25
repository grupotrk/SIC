'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

type ImportRow = {
  nombre: string
  marca?: string
  categoria?: string
  unidad_medida?: string
  precio_venta: number
  precio_costo?: number | null
  stock_actual?: number
  stock_minimo?: number
  permite_fraccion?: boolean
  codigo_barras?: string | null
  observaciones?: string | null
}

interface Props {
  onClose: () => void
  onImported: (message: string) => void | Promise<void>
}

const aliases: Record<string, keyof ImportRow> = {
  nombre: 'nombre', producto: 'nombre', descripcion: 'nombre', descripción: 'nombre',
  marca: 'marca', categoria: 'categoria', categoría: 'categoria',
  unidad: 'unidad_medida', unidad_medida: 'unidad_medida', medida: 'unidad_medida',
  precio: 'precio_venta', precio_venta: 'precio_venta', venta: 'precio_venta',
  precio_costo: 'precio_costo', costo: 'precio_costo',
  stock: 'stock_actual', stock_actual: 'stock_actual',
  stock_minimo: 'stock_minimo', stock_mínimo: 'stock_minimo', minimo: 'stock_minimo', mínimo: 'stock_minimo',
  fraccion: 'permite_fraccion', fracción: 'permite_fraccion', permite_fraccion: 'permite_fraccion',
  codigo_barras: 'codigo_barras', código_barras: 'codigo_barras', codigo: 'codigo_barras', código: 'codigo_barras', ean: 'codigo_barras',
  observaciones: 'observaciones', notas: 'observaciones',
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_')
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const raw = String(value ?? '').trim().replace(/\s/g, '')
  if (!raw) return fallback
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
    : raw.replace(',', '.')
  const number = Number(normalized.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : fallback
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return ['1', 'si', 'sí', 'true', 'x', 'fraccion', 'fracción'].includes(String(value ?? '').trim().toLowerCase())
}

function mapRows(rawRows: Record<string, unknown>[]): { rows: ImportRow[]; errors: string[] } {
  const rows: ImportRow[] = []
  const errors: string[] = []

  rawRows.forEach((raw, index) => {
    const normalized: Partial<Record<keyof ImportRow, unknown>> = {}
    Object.entries(raw).forEach(([header, value]) => {
      const key = aliases[normalizeHeader(header)]
      if (key) normalized[key] = value
    })

    const nombre = String(normalized.nombre ?? '').trim()
    const precioVenta = toNumber(normalized.precio_venta, NaN)
    const stockActual = toNumber(normalized.stock_actual, 0)
    const stockMinimo = toNumber(normalized.stock_minimo, 0)

    if (!nombre) {
      errors.push(`Fila ${index + 2}: falta el nombre.`)
      return
    }
    if (!Number.isFinite(precioVenta) || precioVenta < 0) {
      errors.push(`Fila ${index + 2}: precio de venta inválido.`)
      return
    }
    if (stockActual < 0 || stockMinimo < 0) {
      errors.push(`Fila ${index + 2}: el stock no puede ser negativo.`)
      return
    }

    rows.push({
      nombre,
      marca: String(normalized.marca ?? '').trim(),
      categoria: String(normalized.categoria ?? 'General').trim() || 'General',
      unidad_medida: String(normalized.unidad_medida ?? 'unidad').trim() || 'unidad',
      precio_venta: precioVenta,
      precio_costo: normalized.precio_costo === undefined || String(normalized.precio_costo).trim() === '' ? null : toNumber(normalized.precio_costo, 0),
      stock_actual: stockActual,
      stock_minimo: stockMinimo,
      permite_fraccion: toBoolean(normalized.permite_fraccion),
      codigo_barras: String(normalized.codigo_barras ?? '').trim() || null,
      observaciones: String(normalized.observaciones ?? '').trim() || null,
    })
  })

  return { rows, errors }
}

export default function ProductImportModal({ onClose, onImported }: Props) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [parseError, setParseError] = useState('')

  const preview = useMemo(() => rows.slice(0, 8), [rows])

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setRows([])
    setErrors([])
    setParseError('')

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!sheet) throw new Error('El archivo no contiene hojas.')
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const mapped = mapRows(raw)
      setRows(mapped.rows)
      setErrors(mapped.errors)
      if (!mapped.rows.length) setParseError('No se encontraron filas válidas para importar.')
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'No se pudo leer el archivo.')
    }
  }

  const importRows = async () => {
    if (!rows.length) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesión expirada.')

      const response = await fetch('/api/owner/products/import-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rows }),
      })
      const payload = await response.json() as { success?: boolean; error?: string; inserted?: number; updated?: number; skipped?: number }
      if (!response.ok || !payload.success) throw new Error(payload.error ?? 'No se pudo importar el archivo.')

      await onImported(`Importación completa: ${payload.inserted ?? 0} nuevos, ${payload.updated ?? 0} actualizados${payload.skipped ? `, ${payload.skipped} omitidos` : ''}.`)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Error al importar.')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = [
      {
        nombre: 'Coca-Cola 500ml', marca: 'Coca-Cola', categoria: 'Bebidas', unidad_medida: 'unidad',
        precio_venta: 1800, precio_costo: 1200, stock_actual: 20, stock_minimo: 5,
        permite_fraccion: 'no', codigo_barras: '7790000000000', observaciones: '',
      },
    ]
    const worksheet = XLSX.utils.json_to_sheet(template)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos')
    XLSX.writeFile(workbook, 'plantilla-productos-sic.xlsx')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Importar productos</h3>
            <p className="mt-1 text-sm text-slate-500">Acepta Excel (.xlsx/.xls) y CSV. Si encuentra el mismo código de barras, actualiza el producto existente.</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
              Elegir archivo
              <input className="hidden" type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={handleFile} />
            </label>
            <button onClick={downloadTemplate} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Descargar plantilla Excel</button>
            {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Columnas reconocidas: <strong>nombre</strong>, marca, categoría, unidad, precio_venta, precio_costo, stock, stock_minimo, permite_fraccion, codigo_barras y observaciones.
          </div>

          {parseError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{parseError}</div>}
          {errors.length > 0 && (
            <div className="max-h-28 overflow-auto rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <strong>{errors.length} fila(s) omitidas:</strong>
              {errors.slice(0, 12).map((error) => <div key={error}>{error}</div>)}
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">Vista previa</h4>
                <span className="text-xs text-slate-500">{rows.length} filas válidas</span>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr><th className="px-3 py-2 text-left">Producto</th><th className="px-3 py-2 text-left">Categoría</th><th className="px-3 py-2 text-right">Precio</th><th className="px-3 py-2 text-right">Stock</th><th className="px-3 py-2 text-left">Código</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {preview.map((row, index) => (
                      <tr key={`${row.nombre}-${index}`}>
                        <td className="px-3 py-2 font-semibold text-slate-800">{row.nombre}</td>
                        <td className="px-3 py-2 text-slate-500">{row.categoria}</td>
                        <td className="px-3 py-2 text-right">${row.precio_venta.toLocaleString('es-AR')}</td>
                        <td className="px-3 py-2 text-right">{row.stock_actual ?? 0}</td>
                        <td className="px-3 py-2 text-slate-500">{row.codigo_barras ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button onClick={onClose} disabled={loading} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancelar</button>
          <button onClick={importRows} disabled={loading || rows.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {loading ? 'Importando...' : `Importar ${rows.length || ''} producto${rows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
