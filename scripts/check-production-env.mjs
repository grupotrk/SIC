const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_JWT_SECRET',
]

const placeholder = /(TU_|YOUR_|REEMPLAZAR|example\.com|changeme|placeholder)/i
const missing = []
const unsafe = []

for (const key of required) {
  const value = String(process.env[key] || '').trim()
  if (!value) missing.push(key)
  else if (placeholder.test(value)) unsafe.push(key)
}

const paymentsEnabled = String(process.env.PAYMENTS_ENABLED || '').toLowerCase() === 'true'
if (paymentsEnabled) {
  const provider = String(process.env.PAYMENT_PROVIDER || '').toLowerCase()
  if (provider !== 'mercadopago') unsafe.push('PAYMENT_PROVIDER')
  if (!String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim()) missing.push('MERCADOPAGO_ACCESS_TOKEN')
  if (!String(process.env.PAYMENT_SUCCESS_URL || '').trim()) missing.push('PAYMENT_SUCCESS_URL')
}

if (missing.length || unsafe.length) {
  console.error('\nSIDEA SIC · chequeo de producción: ERROR')
  if (missing.length) console.error('Faltan variables:', missing.join(', '))
  if (unsafe.length) console.error('Variables con placeholder/configuración inválida:', unsafe.join(', '))
  process.exit(1)
}

console.log('SIDEA SIC · variables críticas de producción: OK')
console.log(`Pagos online: ${paymentsEnabled ? 'habilitados' : 'deshabilitados (correcto si todavía no definieron pasarela)'}`)
