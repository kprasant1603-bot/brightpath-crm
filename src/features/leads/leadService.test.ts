import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkLeadDuplicate,
  fetchLeadPage,
  LeadServiceError,
} from './leadService'

const queryMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  is: vi.fn(),
  or: vi.fn(),
  eq: vi.fn(),
  range: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabaseClient: {
    from: queryMocks.from,
    rpc: queryMocks.rpc,
  },
}))

describe('fetchLeadPage', () => {
  beforeEach(() => {
    for (const mock of [
      queryMocks.from,
      queryMocks.rpc,
      queryMocks.select,
      queryMocks.order,
      queryMocks.is,
      queryMocks.or,
      queryMocks.eq,
      queryMocks.range,
    ]) {
      mock.mockReset()
    }

    const query = {
      select: queryMocks.select,
      order: queryMocks.order,
      is: queryMocks.is,
      or: queryMocks.or,
      eq: queryMocks.eq,
      range: queryMocks.range,
    }
    queryMocks.from.mockReturnValue(query)
    queryMocks.select.mockReturnValue(query)
    queryMocks.order.mockReturnValue(query)
    queryMocks.is.mockReturnValue(query)
    queryMocks.or.mockReturnValue(query)
    queryMocks.eq.mockReturnValue(query)
    queryMocks.range.mockResolvedValue({ data: [], count: 0, error: null })
  })

  it('uses server-side range with page size 25 by default', async () => {
    await fetchLeadPage({ page: 1 })

    expect(queryMocks.range).toHaveBeenCalledWith(0, 24)
    expect(queryMocks.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(queryMocks.order.mock.calls).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
  })

  it('caps the requested page size at 100 and applies filters server-side', async () => {
    await fetchLeadPage({
      page: 2,
      pageSize: 500,
      search: '100%',
      stage: 'contacted',
      sourceId: 'fictional-source-id',
      courseId: 'fictional-course-id',
      assignedTo: 'fictional-counsellor-id',
    })

    expect(queryMocks.range).toHaveBeenCalledWith(100, 199)
    expect(queryMocks.is).toHaveBeenCalledWith('archived_at', null)
    expect(queryMocks.or).toHaveBeenCalledWith(
      expect.stringContaining(String.raw`full_name.ilike."%100\%%"`),
    )
    expect(queryMocks.eq).toHaveBeenCalledWith('stage_code', 'contacted')
    expect(queryMocks.eq).toHaveBeenCalledWith('source_id', 'fictional-source-id')
    expect(queryMocks.eq).toHaveBeenCalledWith('course_id', 'fictional-course-id')
    expect(queryMocks.eq).toHaveBeenCalledWith('assigned_to', 'fictional-counsellor-id')
  })

  it('does not filter archived rows when the manager includes them', async () => {
    await fetchLeadPage({ page: 1, includeArchived: true })

    expect(queryMocks.is).not.toHaveBeenCalled()
  })

  it('normalizes duplicate-check inputs and distinguishes rate limits', async () => {
    queryMocks.rpc.mockResolvedValue({
      data: [
        {
          has_match: null,
          owner_name: null,
          rate_limited: true,
          invalid_input: false,
        },
      ],
      error: null,
    })

    await expect(
      checkLeadDuplicate('9876543210', '  LEAD@EXAMPLE.TEST '),
    ).rejects.toMatchObject<Partial<LeadServiceError>>({
      code: 'DUPLICATE_RATE_LIMITED',
    })
    expect(queryMocks.rpc).toHaveBeenCalledWith('check_lead_duplicate', {
      p_phone_e164: '+919876543210',
      p_email: 'lead@example.test',
    })
  })

  it('distinguishes invalid-input responses from rate limits', async () => {
    queryMocks.rpc.mockResolvedValue({
      data: [
        {
          has_match: null,
          owner_name: null,
          rate_limited: false,
          invalid_input: true,
        },
      ],
      error: null,
    })

    await expect(checkLeadDuplicate('9876543210', null)).rejects.toMatchObject({
      code: 'DUPLICATE_INVALID_INPUT',
    })
  })
})
