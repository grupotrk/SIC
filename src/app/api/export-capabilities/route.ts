import { NextResponse } from 'next/server'
import { getExportCapabilitiesByRole } from '@/lib/exportPolicy'
import { getServerSessionRole } from '@/lib/serverSession'

export async function GET() {
  const role = await getServerSessionRole()

  if (!role) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const capabilities = getExportCapabilitiesByRole(role)
  return NextResponse.json({ ok: true, role, capabilities }, { status: 200 })
}
