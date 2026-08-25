export type ReferralType = 'DI' | 'DU' | 'CT' | 'AV'

const BODY = '[A-HJ-NP-Z2-9]{4}'
const STRICT_REGEX = new RegExp(`^TKI-(DI|DU|CT|AV)-${BODY}$`)
const LEGACY_REGEX = /^[A-Z0-9]{6,12}$/

export function normalizeReferralCode(raw: string): string {
  return String(raw || '').trim().toUpperCase()
}

export function getReferralType(code: string): ReferralType | null {
  const c = normalizeReferralCode(code)
  const match = c.match(/^TKI-(DI|DU|CT|AV)-[A-HJ-NP-Z2-9]{4}$/)
  return (match?.[1] as ReferralType | undefined) ?? null
}

export function isValidReferralCode(code: string): boolean {
  const c = normalizeReferralCode(code)
  return STRICT_REGEX.test(c) || LEGACY_REGEX.test(c)
}

export function isStrictTrikodeReferralCode(code: string): boolean {
  return STRICT_REGEX.test(normalizeReferralCode(code))
}
