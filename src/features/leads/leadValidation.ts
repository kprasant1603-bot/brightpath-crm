export const leadStages = [
  'new',
  'contacted',
  'counselling_done',
  'campus_visit',
  'applied',
  'enrolled',
  'lost',
] as const

export const lostReasons = [
  'not_interested',
  'no_response',
  'chose_competitor',
  'not_eligible',
  'other',
] as const

export type LeadStage = (typeof leadStages)[number]
export type LostReason = (typeof lostReasons)[number]

export type PhoneNormalization =
  | { ok: true; value: string }
  | { ok: false; message: string }

export function normalizePhoneToE164(input: string): PhoneNormalization {
  const trimmed = input.trim()
  const compact = trimmed.replace(/[\s().-]/g, '')

  if (!compact || /[^+\d]/.test(compact) || (compact.includes('+') && !compact.startsWith('+'))) {
    return {
      ok: false,
      message: 'Enter a valid phone number. Use a 10-digit Indian number or +country code.',
    }
  }

  const digits = compact.startsWith('+') ? compact.slice(1) : compact
  const e164 = compact.startsWith('+')
    ? `+${digits}`
    : digits.length === 10
      ? `+91${digits}`
      : ''

  if (!/^\+[1-9]\d{1,14}$/.test(e164)) {
    return {
      ok: false,
      message: 'This number cannot be normalized. Use a 10-digit Indian number or enter +country code.',
    }
  }

  return { ok: true, value: e164 }
}

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

export function validateLeadStageChange(stage: LeadStage, reason: string | null) {
  return stage !== 'lost' || (reason !== null && lostReasons.includes(reason as LostReason))
}

export function escapeSearchTermForOrFilter(search: string): string {
  const escaped = search.replace(/[\\%_",().:]/g, '\\$&')
  return `"%${escaped}%"`
}

export function buildLeadSearchFilter(search: string): string {
  const value = escapeSearchTermForOrFilter(search)
  return [
    `full_name.ilike.${value}`,
    `phone_e164.ilike.${value}`,
    `email.ilike.${value}`,
  ].join(',')
}
