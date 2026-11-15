import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeadsPage } from './LeadsPage'

const serviceMocks = vi.hoisted(() => ({
  fetchLeadLookups: vi.fn(),
  fetchLeadPage: vi.fn(),
  checkLeadDuplicate: vi.fn(),
  createLead: vi.fn(),
  setLeadArchived: vi.fn(),
  updateLead: vi.fn(),
}))

vi.mock('./leadService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./leadService')>()
  return {
    ...actual,
    checkLeadDuplicate: serviceMocks.checkLeadDuplicate,
    createLead: serviceMocks.createLead,
    fetchLeadLookups: serviceMocks.fetchLeadLookups,
    fetchLeadPage: serviceMocks.fetchLeadPage,
    setLeadArchived: serviceMocks.setLeadArchived,
    updateLead: serviceMocks.updateLead,
  }
})

const fictionalLead = {
  archived_at: null,
  assigned_to: null,
  campaign_name: null,
  consent_at: null,
  consent_given: null,
  consent_source: null,
  course_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by: 'fictional-counsellor-id',
  email: 'fictional-lead@example.test',
  enrolled_at: null,
  full_name: 'Fictional Test Lead',
  id: 'fictional-lead-id',
  lost_note: null,
  lost_reason: null,
  phone_e164: '+919876543210',
  source_id: null,
  stage_code: 'new',
  updated_at: '2026-01-01T00:00:00.000Z',
  utm_campaign: null,
  utm_content: null,
  utm_medium: null,
  utm_source: null,
  utm_term: null,
}

describe('LeadsPage role-specific filters and controls', () => {
  beforeEach(() => {
    serviceMocks.fetchLeadLookups.mockReset()
    serviceMocks.fetchLeadLookups.mockResolvedValue({
      courses: [],
      sources: [],
      counsellors: [],
    })
    serviceMocks.fetchLeadPage.mockReset()
    serviceMocks.fetchLeadPage.mockResolvedValue({
      rows: [fictionalLead],
      count: 0,
      page: 1,
      pageSize: 25,
    })
    serviceMocks.checkLeadDuplicate.mockReset()
    serviceMocks.checkLeadDuplicate.mockResolvedValue({
      hasMatch: false,
      ownerName: null,
    })
    serviceMocks.createLead.mockReset()
    serviceMocks.createLead.mockResolvedValue(fictionalLead)
    serviceMocks.setLeadArchived.mockReset()
    serviceMocks.setLeadArchived.mockResolvedValue(undefined)
    serviceMocks.updateLead.mockReset()
    serviceMocks.updateLead.mockResolvedValue(fictionalLead)
  })

  it('does not show assignee or archive controls to counsellors', async () => {
    render(<LeadsPage role="counsellor" />)

    expect(await screen.findByText('Fictional Test Lead')).toBeInTheDocument()
    expect(screen.queryByLabelText('Assigned counsellor')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Include archived')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })

  it.each(['manager', 'admin'] as const)(
    'shows team filters and archive control to %s',
    async (role) => {
      render(<LeadsPage role={role} />)

      expect(await screen.findByLabelText('Assigned counsellor')).toBeInTheDocument()
      expect(screen.getByLabelText('Include archived')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    },
  )

  it('only checks duplicates after the create form is submitted', async () => {
    const user = userEvent.setup()
    render(<LeadsPage role="counsellor" />)
    await user.click(await screen.findByRole('button', { name: 'Create lead' }))
    await user.type(screen.getByLabelText('Full name'), 'Another Fictional Lead')
    await user.type(screen.getByLabelText(/^Phone/), '9876543211')
    await user.type(screen.getByLabelText('Email'), 'another@example.test')

    expect(serviceMocks.checkLeadDuplicate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Check & create lead' }))

    await waitFor(() =>
      expect(serviceMocks.checkLeadDuplicate).toHaveBeenCalledWith(
        '+919876543211',
        'another@example.test',
      ),
    )
    expect(serviceMocks.createLead).toHaveBeenCalled()
  })

  it('uses the counsellor existence-only duplicate warning', async () => {
    const user = userEvent.setup()
    serviceMocks.checkLeadDuplicate.mockResolvedValue({
      hasMatch: true,
      ownerName: null,
    })
    render(<LeadsPage role="counsellor" />)
    await user.click(await screen.findByRole('button', { name: 'Create lead' }))
    await user.type(screen.getByLabelText('Full name'), 'Another Fictional Lead')
    await user.type(screen.getByLabelText(/^Phone/), '9876543211')
    await user.click(screen.getByRole('button', { name: 'Check & create lead' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'A possible duplicate exists, ask your manager before creating another lead.',
    )
    expect(serviceMocks.createLead).not.toHaveBeenCalled()
  })

  it('does not offer protected ownership fields in the edit form', async () => {
    const user = userEvent.setup()
    render(<LeadsPage role="manager" />)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const form = screen.getByRole('heading', { name: 'Edit lead' }).closest('section')
    expect(form).not.toBeNull()
    expect(within(form as HTMLElement).getByLabelText('Stage')).toBeInTheDocument()
    expect(screen.queryByLabelText('Assigned to')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Created by')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/assigned counsellor/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/created by/i)).not.toBeInTheDocument()
  })
})
