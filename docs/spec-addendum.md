# BrightPath CRM — Specification Addendum

## Status and scope

This addendum expands the available BrightPath CRM master specification. It is a planning document only: it does not implement features, apply a migration, create an account resource, commit, or deploy.

The recommendations below target a two-day workshop for a fictional, single-branch coaching institute. Use fictional data only. A complete production-grade CRM is not a realistic two-day deliverable. Prioritize a small, secure lead workflow and a genuinely verified deployment over breadth.

Items classified **MVP-now** are included in the proposed implementation scope. **Later** items remain documented and their schema impact is designed in Phase 3, but their feature behavior is deferred. **Cut** means excluded from the workshop scope. The rough effort sizes are S (up to about half a day), M (about 1–2 days), and L (more than 2 days), excluding account/provider delays.

## Core admissions workflow

### Roles

- **Admin:** invites users, manages roles and deactivation through authorized server-side operations.
- **Manager:** views team work, assigns/reassigns leads, and links duplicate records.
- **Counsellor:** creates and manages leads they created or are assigned; creates follow-ups and records interactions.

New profiles use the least-privileged `counsellor` role. Users may not self-promote or edit protected roles. An inactive account must not retain data access.

### Pipeline proposal

Proposed stages: `New`, `Contacted`, `Counselling/Demo Done`, `Campus Visit`, `Applied`, `Enrolled`, `Lost`. The stage transition history is append-only for normal users. `lost_reason` is required when a lead becomes Lost; `enrolled_at` is set when it becomes Enrolled.

This intentionally changes the master prompt’s simpler `Qualified`/`Converted` statuses. Confirm the final stage vocabulary and conversion KPI before applying Phase 3 migrations. The recommended meaning of conversion is Enrolled leads / all leads visible to the current user, with safe zero-denominator behavior.

### Duplicate detection

Normalize phone to E.164 using an explicitly agreed country policy and email to lowercase before exact duplicate matching. The addendum requests a narrow `SECURITY DEFINER` routine to let counsellors detect a match outside their normal row visibility and return only match existence plus owner name. That crosses the ordinary RLS boundary and can enable enumeration or disclose staff identity.

Before any migration, security review should decide the precise caller roles, response fields, throttling/logging, and whether the owner name is manager-only. Use a fixed safe `search_path`, revoke execution from `PUBLIC`/`anon`, grant only to authenticated roles with a need, strictly normalize/validate inputs, and test direct function calls and enumeration resistance. Manager duplicate handling should link records or preserve history; destructive merge is not recommended for the workshop.

## Initial schema design requirement

Phase 3 must design the complete accepted schema before the first database application, so later phases do not invent schema unexpectedly. Core/addendum candidates include:

- `profiles` with `role`, `is_active`, timestamps.
- `leads` with normalized phone/email, proposed pipeline stage, required-on-Lost reason, enrollment timestamp, source/course references, assignment/creator, UTM/campaign data, optional approved student/guardian/contact/priority/consent fields, tags and `archived_at`.
- `follow_ups` with due/status/assignee/creator/completion, outcome and reschedule/snooze fields if retained.
- `activities` plus typed `lead_interactions`, with channel and outcome.
- `lead_status_history`, `lead_assignment_history`, separate `lead_notes`.
- `courses` and `lead_sources` lookup tables; tags and lead-tag relation.
- `audit_log` and `updated_at` triggers where approved.
- Duplicate check/link data/function and indexes for normalization, lookup, sorting, and server-side pagination/search.
- Attachment metadata and Supabase Storage bucket/policies only if attachments remain in scope.

Use UUIDs, `timestamptz`, explicit FK/delete behavior, constraints, and indexes. Every client-accessible table and Storage object requires RLS. Every planned schema object needs an explicit reason; later feature UI must remain disabled until its phase. `organization_id`/`branch_id` is not part of this design unless multi-branch scope is confirmed. No real student data belongs in workshop fixtures.

## Addendum triage

### A. P0 requirements

All P0 requirements remain in the project plan. Priority does not imply they all fit the two-day delivery; the recommendations below identify what to keep active in the workshop.

| Requirement | Triage | Effort | Reason / treatment |
|---|---|---:|---|
| Normalize phone to E.164 and lowercase email; warn/block duplicates on lead creation | **MVP-now** | M | Prevents avoidable duplicate student enquiries; choose phone-country policy first and verify normalization. |
| Narrow `SECURITY DEFINER` duplicate lookup bypassing counsellor row visibility | **MVP-now, security-gated** | L | Needed to detect cross-owner duplicates, but must have fixed `search_path`, minimum grants/response, and enumeration/rate tests. |
| Return “matching lead exists + owner name” | **MVP-now only after explicit privacy decision** | M | Owner identity is more disclosure than existence; proposed default is existence-only for counsellors and owner detail for managers unless the owner approves wider disclosure. |
| Manager-only duplicate merge/link flow | **MVP-now: link, not destructive merge** | M | Linking preserves history and is safer. Destructive merge is **Later** (L) due to child records, audit, and rollback complexity. |
| Extended enquiry-to-admission statuses and Kanban | **MVP-now** | L | Core product workflow. Recommended stages: New, Contacted, Counselling/Demo Done, Campus Visit, Applied, Enrolled, Lost; finalize before migration. |
| Required Lost reason | **MVP-now** | S | Enforce in UI and database; test both transition and persisted record. |
| `enrolled_at` and `lead_status_history` | **MVP-now** | M | Needed for accurate conversion and traceable stage changes; append-only history policy. |
| Public enquiry form through Supabase Edge Function with honeypot/CAPTCHA, rate limiting, validation, no browser secrets | **Later** | L | Public attack surface and CAPTCHA/account setup exceed workshop time. Keep public direct table writes disabled. |
| CSV import with validation preview | **Later** | L | Useful but expands parsing, partial failure, duplicate handling, and privacy testing. |
| CSV export | **Later** | M | Must be permission-scoped and protect against spreadsheet formula injection. |
| UTM/campaign attribution fields | **MVP-now in schema; UI/reporting later** | S | Low-cost to reserve in initial schema and avoids migration churn; do not claim attribution until capture exists. |
| Manager single-lead assignment | **MVP-now** | M | Required for ownership and team workflow. |
| Bulk reassignment and reassignment history | **History MVP-now; bulk Later** | M | Design history table in Phase 3; bulk UI can follow once atomic/partial-failure semantics are clear. |
| Optional round-robin assignment | **Later** | M | Automation not needed to validate manual assignment; adds balancing policy and race concerns. |
| Reassignment procedure for deactivated users | **MVP-now as documented owner procedure** | M | Prevents orphaned work; automate with admin workflow later. |
| Admin screen: invite users, role changes, deactivate with `is_active` | **Later UI; security/schema design MVP-now** | L | Privileged Auth Admin API must be server-side and audited. Profile state/policy design belongs in Phase 3. |
| Email confirmation, password policy, Site URL/redirect URLs for Vercel | **MVP-now setup documentation** | S | Necessary to make deployed Auth flow work reliably. Account owner configures provider. |
| MFA for admins | **Later; production gate before real sensitive data** | M | Requires account settings, recovery design, and tested enforced policy. |

### B. P1 requirements

| Requirement | Triage | Effort | Reason / treatment |
|---|---|---:|---|
| Student age/grade | **Later; conditional schema** | S | Adds personal data; collect only if the workflow requires it and retention is defined. |
| Guardian name and phone | **Later; conditional schema** | M | Adds third-party PII and consent/retention duties; do not collect by default in workshop. |
| City | **Later; conditional schema** | S | Add only if routing/reporting requires it. |
| Preferred contact time | **Later; conditional schema** | S | Helpful but not a core lead workflow. |
| Priority/temperature | **Later; conditional schema** | S | Define measurable semantics before adding a subjective field. |
| Tags | **Later; schema design in Phase 3** | M | Requires a controlled vocabulary and join table; not needed in workshop Kanban. |
| Consent flag and timestamp | **MVP-now as privacy-design requirement; UI collection later** | M | Define purpose, capture source, and retention before real data; a boolean alone may be insufficient evidence. |
| `courses` and `sources` lookup tables replacing free-text | **MVP-now schema; minimal seed/data UI** | M | Keeps reporting consistent. Ensure owner-controlled source/course maintenance is defined. |
| Interaction types: call, WhatsApp, email, meeting, with outcome | **Later** | M | Basic activity history is enough for workshop; WhatsApp remains manual logging, not an integration. |
| Separate notes table | **MVP-now schema; feature UI may be basic** | S | Supports separate notes and RLS; align visibility to the lead policy. |
| Follow-up reschedule/snooze | **Later** | M | Defer until create/complete/cancel behavior is reliable. |
| Follow-up outcome | **Later; schema design in Phase 3** | S | Useful for operations but needs a controlled outcome vocabulary. |
| Agenda/calendar view | **Later** | M | List view is sufficient for initial workflow. |
| Auto-create first follow-up | **Later** | S | Add only after manual scheduling behavior is validated. |
| Stale lead after 7 days without activity | **Later** | S | Define eligible statuses, business days, and exclusions first. |
| First-response-time SLA | **Later** | M | Needs unambiguous start/stop events and reliable source timestamps. |
| In-app reminders | **Later** | L | Delivery timing, state, and notification UX exceed workshop scope. |
| Funnel-by-stage report | **Later** | M | Basic stage distribution is MVP; historical funnel rates require period/cohort definitions. |
| Counsellor performance report | **Later** | M | Fair attribution and role visibility need explicit policy. |
| Source performance report | **Later** | M | Wait until source lookup/attribution data is clean. |
| Lost-reason report | **Later** | S | Depends on stable reason taxonomy and sufficient real data. |
| Average days to convert | **Later** | S | Requires an approved conversion definition and reliable `enrolled_at`. |
| Date-range filters | **Later** | M | Add after base reports and timezone semantics are tested. |
| Report CSV export | **Later** | M | Reuse secure export approach; avoid widening scope in initial release. |
| Soft delete via `archived_at` | **MVP-now schema and basic archive semantics** | M | Safer than irreversible deletion; ensure every query and metric excludes archived records consistently. |
| Trigger-based `audit_log` | **Later behavior; schema design in Phase 3** | L | Accountability is valuable, but retention, access, and PII minimization require review. |
| `updated_at` triggers | **MVP-now** | S | Reliable database-owned update timestamps prevent client inconsistency. |
| `pg_trgm` or full-text search | **Later unless benchmark requires** | M | Begin with indexed server-side filters/search; expand only after measured evidence. |
| Server-side pagination | **MVP-now** | M | Required to avoid unbounded client reads and support 10,000 leads. |
| Supabase Storage attachments with Storage RLS | **Later** | L | Requires object-level policies, upload limits, privacy and possible malware handling. Design schema/policy only if retained. |

### C. Engineering and quality requirements

| Requirement | Triage | Effort | Reason / treatment |
|---|---|---:|---|
| `vercel.json` SPA rewrite for React Router deep links | **MVP-now when routes are added** | S | Prevent direct route refresh 404; verify on actual preview deployment. |
| React Hook Form | **MVP-now if forms justify it** | M | Repeated lead forms benefit from consistent state, errors and submission handling. Avoid adding before form implementation. |
| Zod | **MVP-now** | M | Share validation shape between UI/server where practical; DB constraints remain authoritative. |
| TanStack Query | **Later unless observed need** | M | Start with simple typed service layer; add caching/invalidation only when request complexity warrants dependency. |
| `supabase gen types` | **MVP-now after schema applied locally/dev** | S | Generate DB contracts from the real migration state; do not hand-duplicate DB types. |
| Vitest unit tests | **MVP-now** | M | Test normalization, form validation, status transition, duplicate response and metric definitions. |
| Playwright E2E | **Later for workshop; production hardening target** | L | Valuable regression but initial browser tooling and auth test environment may exceed two days; manual preview verification is not a substitute for RLS tests. |
| SQL/pgTAP RLS tests with at least two roles | **MVP-now security gate** | L | Direct database authorization tests are required; UI tests cannot prove RLS. |
| GitHub Actions lint/type-check/build | **MVP-now** | M | Prevent broken feature commits and support staged delivery. |
| Dependabot | **Later** | S | Good maintenance practice, not core workflow acceptance. |
| Separate dev and prod Supabase projects; Vercel preview/prod env vars | **MVP-now before deployment** | M | Prevent workshop changes touching production; never reuse production credentials for previews. |
| Error tracking | **Later** | M | Requires provider selection, authorization, privacy/PII review, and configuration. |
| Backup/restore notes | **MVP-now documentation** | S | Owner needs an honest recovery/runbook before real operational use. |
| Security headers/CSP | **MVP-now deployment baseline** | M | Configure and verify Supabase/Vercel origins without breaking auth callbacks. |
| Supabase free-tier pause notice | **MVP-now documentation** | S | Explain inactivity pause/resume behavior and possible cold start to workshop users. |
| Under 2 seconds with 10,000 leads | **MVP-now target and benchmark** | M | Use server pagination/indexes and a documented environment; do not claim pass before measuring. |
| Privacy retention policy | **MVP-now policy draft; owner review required** | M | Define purpose, retention, access, and deletion before real student data. |
| Erasure/anonymization procedure | **MVP-now policy/runbook; implementation/security review required** | M | Preserve legally/operationally required audit records while minimizing personal data; no unsupported compliance claim. |
| PII handling | **MVP-now** | M | Minimize collection, restrict access, avoid secrets/PII in logs and demo data. |
| Qualified review of India DPDP Act 2023 | **Later, mandatory before relevant production use** | M | Legal compliance needs qualified legal/privacy review; code cannot certify it. |

### D. UI requirements

| Requirement | Triage | Effort | Reason / treatment |
|---|---|---:|---|
| Distinctive professional non-template visual system | **MVP-now; preserve Phase 1** | S | Existing shell already uses a product-specific green/stone treatment; document and keep coherent rather than rewrite. |
| Color tokens | **MVP-now; implemented in `src/index.css`** | S | Use `--color-*` tokens: forest `#244B3E`, deep forest `#19382F`, canvas `#F4F4EF`, paper `#FBFBF8`, ink `#242D2A`, muted text `#66716B`, and moss `#A4B99E`. Semantic success/warning/danger/info foreground and surface pairs are provided; preserve readable text and icon contrast. |
| One font pairing | **MVP-now; implemented in `src/index.css`** | S | Use `--font-ui` (Aptos/Segoe UI system sans) for interface text, `--font-display` for headings, and `--font-editorial` (Georgia/Baskerville local stack) for restrained editorial accents. No external font dependency. |
| Spacing scale | **MVP-now; implemented in `src/index.css`** | S | Use `--space-1` through `--space-16`: a 4px base, 8px common rhythm, and 16/24/32px section intervals. New feature CSS should use these tokens rather than inventing a parallel scale. |
| Type, radius, elevation and motion tokens | **MVP-now; implemented in `src/index.css`** | S | Use `--text-*`, `--radius-*`, `--shadow-soft`, and `--motion-*`; interaction motion is 120–160ms and page arrival is capped at 180ms. Avoid adding tokens for one-off decoration without a reusable need. |
| Motion rules and `prefers-reduced-motion` | **MVP-now** | S | Use brief feedback only; do not delay interaction. The shell uses shared motion tokens and retains its reduced-motion override. |
| No multiple styling frameworks | **MVP-now rule** | S | Retain CSS and current conventions; do not add another framework. |

**Design-system implementation note (2026-10-29):** `src/index.css` is the canonical source for palette, typography, spacing, type scale, radii, elevation, and motion tokens. Existing short color/font variable names remain as compatibility aliases for the Phase 1 shell. New page and feature styles should use the canonical tokens; add or change a token only when it represents a reusable product-wide decision. The page-arrival motion now uses the 180ms shared token, and the editorial font token uses the documented local Georgia/Baskerville stack. Reduced-motion behavior remains enforced globally in `src/App.css`.

### E. Future roadmap and tenancy

| Requirement | Triage | Effort | Reason / treatment |
|---|---|---:|---|
| Enrolled lead → `students` table retaining `lead_id` FK | **Later, documentation only** | L | Separate student lifecycle is a distinct product phase; no implementation now. |
| Students → batches/courses | **Later, documentation only** | L | Future education operations scope, not CRM MVP. |
| Fees/invoices | **Cut from CRM MVP; roadmap only** | L | Explicitly excluded as fee collection/ERP. |
| Attendance | **Cut from CRM MVP; roadmap only** | L | LMS/education management extension, not current CRM scope. |
| WhatsApp/email integration | **Cut from CRM MVP; roadmap only** | L | External messaging integration excluded; manual interaction logging may be considered later. |
| Add `organization_id`/`branch_id` to core tables now | **Pending decision; do not add without confirmation** | L | Multi-tenant RLS and duplicate scope affect every table and policy. Recommendation: single branch initially. If confirmed multi-branch, redesign before Phase 3, not after. |

## Two-day workshop cut recommendation

Focus workshop delivery on typed routing/foundation, Supabase Auth, one reviewed and tested schema/RLS set, core lead create/edit/Kanban with stage history, safe duplicate warning plus manager link, basic assignment, follow-ups/activity, role-scoped dashboard, essential CI, and one real Vercel preview retested against development Supabase.

Defer public intake/CAPTCHA, CSV import/export, full admin console, round-robin, rich student/guardian data entry, interaction channels beyond basic log, advanced calendar/reminders/SLA, detailed reports, attachments, error-tracking vendor integration, and Playwright if its setup threatens core security verification. Cut fees, attendance, LMS/ERP, and messaging integrations from the CRM build. Do not cut direct multi-role RLS testing, secret handling, honest test reporting, or development/production separation.

## Design and engineering gates

- Do not read `.env` values. Required names are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; check names only. `VITE_` values are public, so privileged keys must never be placed there.
- Apply SQL only after an owner-reviewed migration and explicit project authorization.
- Use fictional records. Do not claim RLS security, legal compliance, performance, migration success, or deployment success without observed evidence.
- Test authorized and unauthorized database operations directly for at least two roles.
- Define conversion stage and duplicate owner disclosure before schema approval.
- Measure `<2 seconds for list load with 10,000 leads` in a stated test environment; treat it as a target until measured.
- Keep development/preview isolated from production. Owner authorizes paid resources and provider access.
