import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'csv_disabled',
      message: 'La exportacion CSV fue deshabilitada. Usa la exportacion PDF.',
    },
    { status: 410 }
  )
}
