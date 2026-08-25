import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { isValidReferralCode, normalizeReferralCode } from '@/lib/referralCode'

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as null | { ref_code?: unknown }
    const ref_code_raw = typeof body?.ref_code === 'string' ? body.ref_code : ''
    const ref_code = normalizeReferralCode(ref_code_raw)

    if (!ref_code) {
      return NextResponse.json({ valid: false, reason: 'missing' }, { status: 400 })
    }

    if (!isValidReferralCode(ref_code)) {
      return NextResponse.json({ valid: false, reason: 'format' }, { status: 200 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('sales_agents')
      .select('id,nombre,status')
      .eq('ref_code', ref_code)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ valid: false, reason: 'db_error' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 200 })
    }

    if (data.status !== 'active') {
      return NextResponse.json({ valid: false, reason: 'inactive' }, { status: 200 })
    }

    return NextResponse.json({ valid: true, agent: { id: data.id, nombre: data.nombre } }, { status: 200 })
  } catch {
    return NextResponse.json({ valid: false, reason: 'unexpected' }, { status: 500 })
  }
}

