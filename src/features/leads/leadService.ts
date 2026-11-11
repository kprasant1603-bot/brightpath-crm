import { supabaseClient } from '../../lib/supabase'
import type { Database } from '../../types/database.types'
import {
  buildLeadSearchFilter,
  normalizeEmail,
  normalizePhoneToE164,
  validateLeadStageChange,
  type LeadStage,
  type LostReason,
} from './leadValidation'

export type Lead = Database['public']['Tables']['leads']['Row']
export type LeadCreateInput = Pick<
  Database['public']['Tables']['leads']['Insert'],
  | 'full_name'
  | 'phone_e164'
  | 'email'
  | 'course_id'
  | 'source_id'
  | 'campaign_name'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'utm_term'
  | 'utm_content'
  | 'consent_given'
  | 'consent_at'
  | 'consent_source'
>
export type LeadEditInput = Pick<
  Database['public']['Tables']['leads']['Update'],
  | 'full_name'
  | 'phone_e164'
  | 'email'
  | 'course_id'
  | 'source_id'
  | 'stage_code'
  | 'lost_reason'
  | 'lost_note'
  | 'campaign_name'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'utm_term'
  | 'utm_content'
  | 'consent_given'
  | 'consent_at'
  | 'consent_source'
>

export type LeadListFilters = {
  page: number
  pageSize?: number
  search?: string
  stage?: LeadStage | ''
  sourceId?: string
  courseId?: string
  assignedTo?: string
  includeArchived?: boolean
}

export type LeadPage = {
  rows: Lead[]
  count: number
  page: number
  pageSize: number
}

export class LeadServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'DUPLICATE_RATE_LIMITED'
      | 'DUPLICATE_INVALID_INPUT'
      | 'DUPLICATE_CHECK_FAILED'
      | 'LEAD_OPERATION_FAILED',
  ) {
    super(message)
  }
}

export type LeadLookups = {
  courses: Array<Pick<Database['public']['Tables']['courses']['Row'], 'id' | 'name'>>
  sources: Array<Pick<Database['public']['Tables']['lead_sources']['Row'], 'id' | 'name'>>
  counsellors: Array<
    Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'display_name'>
  >
}

function requireSupabaseClient() {
  if (!supabaseClient) {
    throw new Error('Supabase is not configured.')
  }
  return supabaseClient
}

export async function fetchLeadPage(filters: LeadListFilters): Promise<LeadPage> {
  const client = requireSupabaseClient()
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100)
  const page = Math.max(1, filters.page)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = client
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (!filters.includeArchived) {
    query = query.is('archived_at', null)
  }
  if (filters.search?.trim()) {
    query = query.or(buildLeadSearchFilter(filters.search.trim()))
  }
  if (filters.stage) {
    query = query.eq('stage_code', filters.stage)
  }
  if (filters.sourceId) {
    query = query.eq('source_id', filters.sourceId)
  }
  if (filters.courseId) {
    query = query.eq('course_id', filters.courseId)
  }
  if (filters.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) {
    throw new Error('Leads could not be loaded.')
  }

  return {
    rows: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
  }
}

export async function fetchLeadLookups(
  includeCounsellors: boolean,
): Promise<LeadLookups> {
  const client = requireSupabaseClient()
  const [coursesResult, sourcesResult, counsellorsResult] = await Promise.all([
    client.from('courses').select('id, name').order('name'),
    client.from('lead_sources').select('id, name').order('name'),
    includeCounsellors
      ? client
          .from('profiles')
          .select('id, display_name')
          .eq('role', 'counsellor')
          .eq('is_active', true)
          .order('display_name')
      : Promise.resolve({ data: [], error: null }),
  ])

  if (coursesResult.error || sourcesResult.error || counsellorsResult.error) {
    throw new Error('Lead filters could not be loaded.')
  }

  return {
    courses: coursesResult.data ?? [],
    sources: sourcesResult.data ?? [],
    counsellors: counsellorsResult.data ?? [],
  }
}

export async function checkLeadDuplicate(
  phone: string,
  email: string | null,
): Promise<{ hasMatch: boolean; ownerName: string | null }> {
  const client = requireSupabaseClient()
  const normalizedPhone = normalizePhoneToE164(phone)
  if (!normalizedPhone.ok) {
    throw new Error(normalizedPhone.message)
  }

  const normalizedEmail = email ? normalizeEmail(email) : null
  const rpcArguments = normalizedEmail
    ? { p_phone_e164: normalizedPhone.value, p_email: normalizedEmail }
    : { p_phone_e164: normalizedPhone.value }
  const { data, error } = await client.rpc('check_lead_duplicate', rpcArguments)

  if (error || !data?.length) {
    throw new LeadServiceError(
      'Duplicate check could not be completed.',
      'DUPLICATE_CHECK_FAILED',
    )
  }

  const result = data[0]
  if (!result) {
    throw new LeadServiceError(
      'Duplicate check could not be completed.',
      'DUPLICATE_CHECK_FAILED',
    )
  }
  if (result.rate_limited) {
    throw new LeadServiceError(
      'duplicate-rate-limited',
      'DUPLICATE_RATE_LIMITED',
    )
  }
  if (result.invalid_input) {
    throw new LeadServiceError(
      'duplicate-invalid-input',
      'DUPLICATE_INVALID_INPUT',
    )
  }

  return {
    hasMatch: result.has_match === true,
    ownerName: result.owner_name || null,
  }
}

export async function createLead(input: LeadCreateInput): Promise<Lead> {
  const { data, error } = await requireSupabaseClient()
    .from('leads')
    .insert(input)
    .select('*')
    .single()

  if (error || !data) {
    throw new LeadServiceError('Lead could not be created.', 'LEAD_OPERATION_FAILED')
  }
  return data
}

export async function updateLead(
  id: string,
  input: LeadEditInput,
): Promise<Lead> {
  const { data, error } = await requireSupabaseClient()
    .from('leads')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    throw new LeadServiceError('Lead could not be updated.', 'LEAD_OPERATION_FAILED')
  }
  return data
}

export async function setLeadArchived(id: string, archived: boolean) {
  const { error } = await requireSupabaseClient().rpc('set_lead_archived', {
    p_lead_id: id,
    p_archived: archived,
  })
  if (error) {
    throw new LeadServiceError(
      archived ? 'Lead could not be archived.' : 'Lead could not be restored.',
      'LEAD_OPERATION_FAILED',
    )
  }
}

export function makeLeadPayload(values: {
  full_name: string
  phone: string
  email: string
  course_id: string
  source_id: string
  campaign_name: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  consent_given: boolean
  consent_source: string
}) {
  const phone = normalizePhoneToE164(values.phone)
  if (!phone.ok) {
    throw new Error(phone.message)
  }

  return {
    full_name: values.full_name.trim(),
    phone_e164: phone.value,
    email: normalizeEmail(values.email),
    course_id: values.course_id || null,
    source_id: values.source_id || null,
    campaign_name: values.campaign_name.trim() || null,
    utm_source: values.utm_source.trim() || null,
    utm_medium: values.utm_medium.trim() || null,
    utm_campaign: values.utm_campaign.trim() || null,
    utm_term: values.utm_term.trim() || null,
    utm_content: values.utm_content.trim() || null,
    consent_given: values.consent_given,
    consent_at: values.consent_given ? new Date().toISOString() : null,
    consent_source: values.consent_given
      ? values.consent_source.trim() || null
      : null,
  }
}

export function makeLeadEditPayload(
  values: ReturnType<typeof makeLeadPayload>,
  stage: LeadStage,
  lostReason: LostReason | '',
  lostNote: string,
): LeadEditInput {
  if (!validateLeadStageChange(stage, lostReason || null)) {
    throw new Error('Select one of the listed Lost reasons before saving.')
  }

  return {
    ...values,
    stage_code: stage,
    lost_reason: stage === 'lost' ? lostReason || null : null,
    lost_note: stage === 'lost' ? lostNote.trim() || null : null,
  }
}
