import { NextResponse } from 'next/server'
import { hasValidAdminSession } from '@/lib/adminAuth'

export async function GET() {
  try {
    if (!(await hasValidAdminSession())) {
      return NextResponse.json(
        { valid: false },
        { status: 401, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
      )
    }

    return NextResponse.json(
      { valid: true },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
    )
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing env var:')) {
      return NextResponse.json(
        { valid: false, error: 'server_not_configured' },
        { status: 503, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
      )
    }
    return NextResponse.json(
      { valid: false },
      { status: 500, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
    )
  }
}
