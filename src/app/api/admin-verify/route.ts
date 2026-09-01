import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/adminAuth'

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ valid: false }, { status: 401, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } })
    return NextResponse.json({
      valid: true,
      user: {
        source: session.source,
        email: session.email || null,
        nombre: session.nombre || 'Admin SIDEA',
        requires_password_change: Boolean(session.mustChangePassword),
      },
    }, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return NextResponse.json({ valid: false, error: 'server_not_configured' }, { status: 503 })
    }
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
