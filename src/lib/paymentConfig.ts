export type PaymentProvider = 'mercadopago' | 'none'

function env(name: string): string {
  return (process.env[name] || '').trim()
}

export function getPaymentConfig() {
  const explicitlyEnabled = env('PAYMENTS_ENABLED').toLowerCase() === 'true'
  const providerRaw = env('PAYMENT_PROVIDER').toLowerCase()
  const provider: PaymentProvider = providerRaw === 'mercadopago' ? 'mercadopago' : 'none'

  const mercadoPagoConfigured = Boolean(env('MERCADOPAGO_ACCESS_TOKEN'))
  const enabled = explicitlyEnabled && provider === 'mercadopago' && mercadoPagoConfigured

  return {
    enabled,
    provider,
    amount: Number.parseInt(env('SUBSCRIPTION_PRICE') || '40000', 10),
  }
}
