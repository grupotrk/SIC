import { createClient } from '@supabase/supabase-js'

function mustGetEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export function getSupabaseAdmin() {
  const url = mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = mustGetEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

/**
 * Client server-side only for validating a user's access token.
 * Uses the publishable key on purpose: token validation must not depend on
 * the privileged secret key being accepted by the Auth endpoint.
 */
export function getSupabaseAuthVerifier() {
  const url = mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
  const publishableKey = mustGetEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
