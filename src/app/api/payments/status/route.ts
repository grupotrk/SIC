import { NextResponse } from 'next/server'
import { getPaymentConfig } from '@/lib/paymentConfig'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = getPaymentConfig()
  return NextResponse.json(
    {
      ok: true,
      enabled: config.enabled,
      provider: config.enabled ? config.provider : null,
      amount: Number.isFinite(config.amount) ? config.amount : 40000,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
