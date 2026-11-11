import { describe, expect, it } from 'vitest'
import {
  buildLeadSearchFilter,
  lostReasons,
  normalizePhoneToE164,
  validateLeadStageChange,
} from './leadValidation'
import { makeLeadPayload } from './leadService'

describe('lead validation', () => {
  it('uses the database lost reason codes without inventing alternatives', () => {
    expect(lostReasons).toEqual([
      'not_interested',
      'no_response',
      'chose_competitor',
      'not_eligible',
      'other',
    ])
    expect(validateLeadStageChange('lost', 'no_response')).toBe(true)
    expect(validateLeadStageChange('lost', 'made_up_reason')).toBe(false)
    expect(validateLeadStageChange('contacted', null)).toBe(true)
  })

  it('normalizes ten digit Indian numbers and explicit international E.164 numbers', () => {
    expect(normalizePhoneToE164('98765 43210')).toEqual({
      ok: true,
      value: '+919876543210',
    })
    expect(normalizePhoneToE164('+44 (20) 7123-4567')).toEqual({
      ok: true,
      value: '+442071234567',
    })
    expect(normalizePhoneToE164('020 7123 4567').ok).toBe(false)
  })

  it.each([
    ['100%', String.raw`full_name.ilike."%100\%%"`],
    ['a,b', String.raw`full_name.ilike."%a\,b%"`],
    ['(x)', String.raw`full_name.ilike."%\(x\)%"`],
    ['a_b', String.raw`full_name.ilike."%a\_b%"`],
  ])('escapes special search characters in %s', (search, expected) => {
    expect(buildLeadSearchFilter(search)).toContain(expected)
  })

  it('creates a payload without database-managed stage or ownership columns', () => {
    const payload = makeLeadPayload({
      full_name: 'Fictional Lead',
      phone: '9876543210',
      email: '  LEAD@EXAMPLE.TEST ',
      course_id: '',
      source_id: '',
      campaign_name: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      utm_term: '',
      utm_content: '',
      consent_given: false,
      consent_source: '',
    })

    expect(payload).toMatchObject({
      full_name: 'Fictional Lead',
      phone_e164: '+919876543210',
      email: 'lead@example.test',
    })
    expect(payload).not.toHaveProperty('stage_code')
    expect(payload).not.toHaveProperty('created_by')
    expect(payload).not.toHaveProperty('assigned_to')
  })
})
