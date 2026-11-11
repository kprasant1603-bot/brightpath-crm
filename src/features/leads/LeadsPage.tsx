import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AppRole } from '../auth/authContext'
import {
  checkLeadDuplicate,
  createLead,
  fetchLeadLookups,
  fetchLeadPage,
  makeLeadEditPayload,
  makeLeadPayload,
  LeadServiceError,
  setLeadArchived,
  updateLead,
  type Lead,
  type LeadEditInput,
  type LeadLookups,
} from './leadService'
import {
  leadStages,
  lostReasons,
  normalizePhoneToE164,
  type LeadStage,
  type LostReason,
} from './leadValidation'

const pageSize = 25
const stageLabels: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  counselling_done: 'Counselling/Demo Done',
  campus_visit: 'Campus Visit',
  applied: 'Applied',
  enrolled: 'Enrolled',
  lost: 'Lost',
}

type LeadFormValues = {
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
  stage_code: LeadStage
  lost_reason: LostReason | ''
  lost_note: string
}

const emptyForm: LeadFormValues = {
  full_name: '',
  phone: '',
  email: '',
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
  stage_code: 'new',
  lost_reason: '',
  lost_note: '',
}

function formValuesFromLead(lead: Lead): LeadFormValues {
  return {
    full_name: lead.full_name,
    phone: lead.phone_e164,
    email: lead.email ?? '',
    course_id: lead.course_id ?? '',
    source_id: lead.source_id ?? '',
    campaign_name: lead.campaign_name ?? '',
    utm_source: lead.utm_source ?? '',
    utm_medium: lead.utm_medium ?? '',
    utm_campaign: lead.utm_campaign ?? '',
    utm_term: lead.utm_term ?? '',
    utm_content: lead.utm_content ?? '',
    consent_given: lead.consent_given === true,
    consent_source: lead.consent_source ?? '',
    stage_code: lead.stage_code as LeadStage,
    lost_reason: (lead.lost_reason ?? '') as LostReason | '',
    lost_note: lead.lost_note ?? '',
  }
}

function userFacingError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return 'The lead could not be saved. Try again.'
}

function LeadForm({
  lead,
  role,
  lookups,
  onCancel,
  onSaved,
}: {
  lead: Lead | null
  role: AppRole
  lookups: LeadLookups
  onCancel: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<LeadFormValues>(() =>
    lead ? formValuesFromLead(lead) : emptyForm,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicateMessage, setDuplicateMessage] = useState('')
  const [phoneError, setPhoneError] = useState('')

  function setField<K extends keyof LeadFormValues>(
    key: K,
    value: LeadFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setDuplicateMessage('')

    const newPayload = (() => {
      try {
        return makeLeadPayload(values)
      } catch (caught) {
        setError(userFacingError(caught))
        return null
      }
    })()
    if (!newPayload) {
      return
    }
    const payload =
      lead && values.consent_given && lead.consent_given === true
        ? { ...newPayload, consent_at: lead.consent_at }
        : newPayload

    setIsSaving(true)
    try {
      if (lead) {
        const editPayload: LeadEditInput = makeLeadEditPayload(
          payload,
          values.stage_code,
          values.lost_reason,
          values.lost_note,
        )
        await updateLead(lead.id, editPayload)
      } else {
        let duplicate: { hasMatch: boolean; ownerName: string | null }
        try {
          duplicate = await checkLeadDuplicate(payload.phone_e164, payload.email)
        } catch (caught) {
          if (
            caught instanceof LeadServiceError &&
            caught.code === 'DUPLICATE_RATE_LIMITED'
          ) {
            setError('Duplicate checking is rate-limited. Wait before trying again.')
          } else if (
            caught instanceof LeadServiceError &&
            caught.code === 'DUPLICATE_INVALID_INPUT'
          ) {
            setError('This phone number could not be checked. Review the number and try again.')
          } else {
            setError(userFacingError(caught))
          }
          return
        }

        if (duplicate.hasMatch) {
          setDuplicateMessage(
            duplicate.ownerName
              ? `A possible duplicate exists. Owner: ${duplicate.ownerName}. Ask before creating another lead.`
              : role === 'counsellor'
                ? 'A possible duplicate exists, ask your manager before creating another lead.'
                : 'A possible duplicate exists. Review it before creating another lead.',
          )
          return
        }
        await createLead(payload)
      }

      onSaved()
    } catch (caught) {
      setError(userFacingError(caught))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="lead-form-card" aria-labelledby="lead-form-title">
      <div className="lead-form-heading">
        <div>
          <span className="section-kicker">{lead ? 'LEAD DETAILS' : 'NEW ENQUIRY'}</span>
          <h2 id="lead-form-title">{lead ? 'Edit lead' : 'Create lead'}</h2>
        </div>
        <button className="lead-secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>

      <form className="lead-form" onSubmit={handleSubmit}>
        <label>
          Full name
          <input
            autoComplete="name"
            maxLength={200}
            onChange={(event) => setField('full_name', event.target.value)}
            required
            value={values.full_name}
          />
        </label>
        <label>
          Phone
          <input
            autoComplete="tel"
            inputMode="tel"
            onBlur={() => {
              const normalized = normalizePhoneToE164(values.phone)
              setPhoneError(normalized.ok ? '' : normalized.message)
            }}
            onChange={(event) => {
              setField('phone', event.target.value)
              setPhoneError('')
            }}
            required
            value={values.phone}
          />
          <span className="lead-field-help">
            10-digit Indian numbers use +91. Other country codes must be entered
            explicitly with +country code.
          </span>
          {phoneError && <span className="lead-field-error">{phoneError}</span>}
        </label>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setField('email', event.target.value)}
            type="email"
            value={values.email}
          />
        </label>
        <label>
          Course
          <select
            onChange={(event) => setField('course_id', event.target.value)}
            value={values.course_id}
          >
            <option value="">Not selected</option>
            {lookups.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select
            onChange={(event) => setField('source_id', event.target.value)}
            value={values.source_id}
          >
            <option value="">Not selected</option>
            {lookups.sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        {lead && (
          <>
            <label>
              Stage
              <select
                onChange={(event) =>
                  setField('stage_code', event.target.value as LeadStage)
                }
                value={values.stage_code}
              >
                {leadStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabels[stage]}
                  </option>
                ))}
              </select>
            </label>
            {values.stage_code === 'lost' && (
              <label>
                Lost reason
                <select
                  onChange={(event) =>
                    setField('lost_reason', event.target.value as LostReason | '')
                  }
                  required
                  value={values.lost_reason}
                >
                  <option value="">Select a reason</option>
                  {lostReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {values.stage_code === 'lost' && (
              <label>
                Lost note (optional)
                <textarea
                  onChange={(event) => setField('lost_note', event.target.value)}
                  rows={3}
                  value={values.lost_note}
                />
              </label>
            )}
          </>
        )}
        <label>
          Campaign name
          <input
            onChange={(event) => setField('campaign_name', event.target.value)}
            value={values.campaign_name}
          />
        </label>
        <label>
          UTM source
          <input
            onChange={(event) => setField('utm_source', event.target.value)}
            value={values.utm_source}
          />
        </label>
        <label>
          UTM medium
          <input
            onChange={(event) => setField('utm_medium', event.target.value)}
            value={values.utm_medium}
          />
        </label>
        <label>
          UTM campaign
          <input
            onChange={(event) => setField('utm_campaign', event.target.value)}
            value={values.utm_campaign}
          />
        </label>
        <label>
          UTM term
          <input
            onChange={(event) => setField('utm_term', event.target.value)}
            value={values.utm_term}
          />
        </label>
        <label>
          UTM content
          <input
            onChange={(event) => setField('utm_content', event.target.value)}
            value={values.utm_content}
          />
        </label>
        <label className="lead-consent-field">
          <input
            checked={values.consent_given}
            onChange={(event) => setField('consent_given', event.target.checked)}
            type="checkbox"
          />
          Consent recorded
        </label>
        {values.consent_given && (
          <label>
            Consent source
            <input
              onChange={(event) => setField('consent_source', event.target.value)}
              value={values.consent_source}
            />
          </label>
        )}
        {duplicateMessage && (
          <p className="lead-warning" role="status">
            {duplicateMessage}
          </p>
        )}
        {error && (
          <p className="lead-error" role="alert">
            {error}
          </p>
        )}
        <div className="lead-form-actions">
          <button className="lead-primary-button" disabled={isSaving} type="submit">
            {isSaving ? 'Saving…' : lead ? 'Save changes' : 'Check & create lead'}
          </button>
        </div>
      </form>
    </section>
  )
}

function LeadRow({
  lead,
  canManageArchive,
  lookups,
  onEdit,
  onArchive,
}: {
  lead: Lead
  canManageArchive: boolean
  lookups: LeadLookups
  onEdit: () => void
  onArchive: () => void
}) {
  return (
    <tr>
      <td>
        <strong>{lead.full_name}</strong>
        <span className="lead-table-secondary">{lead.email || lead.phone_e164}</span>
      </td>
      <td>{stageLabels[lead.stage_code as LeadStage] ?? lead.stage_code}</td>
      <td>{lead.phone_e164}</td>
      <td>{lookups.courses.find((item) => item.id === lead.course_id)?.name ?? '—'}</td>
      <td>{lookups.sources.find((item) => item.id === lead.source_id)?.name ?? '—'}</td>
      <td>{new Date(lead.created_at).toLocaleDateString()}</td>
      <td className="lead-row-actions">
        <button className="lead-text-button" onClick={onEdit} type="button">
          Edit
        </button>
        {canManageArchive && (
          <button className="lead-text-button" onClick={onArchive} type="button">
            {lead.archived_at ? 'Restore' : 'Archive'}
          </button>
        )}
      </td>
    </tr>
  )
}

export function LeadsPage({ role }: { role: AppRole }) {
  const canManageTeam = role === 'manager' || role === 'admin'
  const [page, setPage] = useState(1)
  const [selectedPageSize, setSelectedPageSize] = useState(pageSize)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState<LeadStage | ''>('')
  const [sourceId, setSourceId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [lookups, setLookups] = useState<LeadLookups>({
    courses: [],
    sources: [],
    counsellors: [],
  })
  const [rows, setRows] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formLead, setFormLead] = useState<Lead | null | undefined>(undefined)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [actionError, setActionError] = useState('')
  const [isArchiving, setIsArchiving] = useState<string | null>(null)

  const filters = useMemo(
    () => ({
      page,
      pageSize: selectedPageSize,
      search,
      stage,
      sourceId,
      courseId,
      assignedTo: canManageTeam ? assignedTo : '',
      includeArchived: canManageTeam && includeArchived,
    }),
    [page, selectedPageSize, search, stage, sourceId, courseId, assignedTo, includeArchived, canManageTeam],
  )
  const pageCount = Math.max(1, Math.ceil(total / selectedPageSize))

  useEffect(() => {
    let active = true

    void Promise.all([
      fetchLeadPage(filters),
      fetchLeadLookups(canManageTeam),
    ])
      .then(([leadPage, nextLookups]) => {
        if (!active) return
        setRows(leadPage.rows)
        setTotal(leadPage.count)
        setLookups(nextLookups)
      })
      .catch(() => {
        if (active) setLoadError('Leads could not be loaded. Try again.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [filters, canManageTeam, refreshVersion])

  async function handleArchive(lead: Lead) {
    setActionError('')
    setLoadError('')
    setIsArchiving(lead.id)
    setIsLoading(true)
    try {
      await setLeadArchived(lead.id, !lead.archived_at)
      setRefreshVersion((current) => current + 1)
    } catch (error) {
      setActionError(userFacingError(error))
      setIsLoading(false)
    } finally {
      setIsArchiving(null)
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoadError('')
    setIsLoading(true)
    setPage(1)
    setSearch(searchInput.trim())
    setRefreshVersion((current) => current + 1)
  }

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setIsLoading(true)
    setLoadError('')
    setPage(1)
    setter(value)
    setRefreshVersion((current) => current + 1)
  }

  function handleFormSaved() {
    setFormLead(undefined)
    setLoadError('')
    setIsLoading(true)
    setPage(1)
    setRefreshVersion((current) => current + 1)
  }

  return (
    <section className="leads-feature" aria-labelledby="leads-title">
      <div className="leads-heading">
        <div>
          <span className="section-kicker">RELATIONSHIPS</span>
          <h2 id="leads-title">Leads</h2>
          <p>Every enquiry, kept in view and moving forward.</p>
        </div>
        <button
          className="lead-primary-button"
          onClick={() => setFormLead(null)}
          type="button"
        >
          Create lead
        </button>
      </div>

      {formLead !== undefined && (
        <LeadForm
          key={formLead?.id ?? 'new'}
          lead={formLead}
          role={role}
          lookups={lookups}
          onCancel={() => setFormLead(undefined)}
          onSaved={handleFormSaved}
        />
      )}

      <section className="lead-list-card" aria-label="Lead list">
        <form className="lead-filters" onSubmit={handleSearchSubmit}>
          <label className="lead-search-field">
            Search leads
            <input
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name, phone or email"
              value={searchInput}
            />
          </label>
          <button className="lead-secondary-button" type="submit">
            Search
          </button>
          <label>
            Stage
            <select
              onChange={(event) =>
                updateFilter(setStage, event.target.value as LeadStage | '')
              }
              value={stage}
            >
              <option value="">All stages</option>
              {leadStages.map((value) => (
                <option key={value} value={value}>
                  {stageLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select
              onChange={(event) => updateFilter(setSourceId, event.target.value)}
              value={sourceId}
            >
              <option value="">All sources</option>
              {lookups.sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Course
            <select
              onChange={(event) => updateFilter(setCourseId, event.target.value)}
              value={courseId}
            >
              <option value="">All courses</option>
              {lookups.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          {canManageTeam && (
            <>
              <label>
                Assigned counsellor
                <select
                  onChange={(event) =>
                    updateFilter(setAssignedTo, event.target.value)
                  }
                  value={assignedTo}
                >
                  <option value="">All counsellors</option>
                  {lookups.counsellors.map((counsellor) => (
                    <option key={counsellor.id} value={counsellor.id}>
                      {counsellor.display_name || counsellor.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lead-archived-toggle">
                <input
                  checked={includeArchived}
                  onChange={(event) =>
                    updateFilter(setIncludeArchived, event.target.checked)
                  }
                  type="checkbox"
                />
                Include archived
              </label>
            </>
          )}
        </form>

        {actionError && (
          <p className="lead-error" role="alert">
            {actionError}
          </p>
        )}
        {loadError && (
          <div className="lead-error-state" role="alert">
            <p>{loadError}</p>
            <button
              className="lead-secondary-button"
              onClick={() => {
                setIsLoading(true)
                setRefreshVersion((current) => current + 1)
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        )}
        {isLoading ? (
          <p className="lead-list-message" role="status">
            Loading leads…
          </p>
        ) : !loadError && rows.length === 0 ? (
          <p className="lead-list-message" role="status">
            No leads match these filters.
          </p>
        ) : (
          !loadError && (
            <>
              <div className="lead-table-wrap">
                <table className="lead-table">
                  <thead>
                    <tr>
                      <th scope="col">Lead</th>
                      <th scope="col">Stage</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Course</th>
                      <th scope="col">Source</th>
                      <th scope="col">Created</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((lead) => (
                      <LeadRow
                        canManageArchive={canManageTeam && !isArchiving}
                        key={lead.id}
                        lead={lead}
                        lookups={lookups}
                        onArchive={() => void handleArchive(lead)}
                        onEdit={() => setFormLead(lead)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="lead-pagination" aria-label="Lead pagination">
                <span>
                  {total} {total === 1 ? 'lead' : 'leads'} · Page {page} of {pageCount}
                </span>
                <div>
                  <label className="lead-page-size">
                    Rows
                    <select
                      onChange={(event) =>
                        updateFilter(setSelectedPageSize, Number(event.target.value))
                      }
                      value={selectedPageSize}
                    >
                      {[25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="lead-secondary-button"
                    disabled={page <= 1}
                    onClick={() =>
                      updateFilter(setPage, Math.max(1, page - 1))
                    }
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="lead-secondary-button"
                    disabled={page >= pageCount}
                    onClick={() =>
                      updateFilter(setPage, Math.min(pageCount, page + 1))
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </section>
      {isArchiving && (
        <p className="lead-list-message" role="status">
          Updating archive state…
        </p>
      )}
    </section>
  )
}
