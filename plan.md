# BrightPath CRM — Amended Project Plan

## Purpose and source

This plan follows the available [BrightPath_CRM_Full_Master_Build_Prompt.docx](./BrightPath_CRM_Full_Master_Build_Prompt.docx) and the approved project addendum documented in [docs/spec-addendum.md](./docs/spec-addendum.md). The separately named Antigravity document was not present when this plan was prepared.

The MVP is a focused CRM for a fictional coaching institute. Use fictional records only. Do not build an LMS, fees/ERP, messaging integrations, or other excluded product areas in this workshop.

## Current repository and Phase 1 baseline

- React + Vite shell with branded Overview, Leads, Follow-ups, Reports, and Settings views, desktop sidebar, responsive mobile navigation, preview/empty states, and reduced-motion styling.
- Navigation is currently local component state; there is no router, CRM data workflow, Supabase client, TypeScript app source/configuration, migration, or test runner.
- `package.json` provides `npm run dev`, `npm run build`, `npm run lint`, and `npm run preview`. Dependencies are React/React DOM, Vite, and Oxlint.
- No local `.env` was present during the name-only inspection. No secret values were read. Supabase/Vercel account setup is not verified.
- `.gitignore` excludes `.env` and permits `.env.example`.
- Git is on `main` with an `origin` remote. Phase 1 files are modified; `plan.md` and the master specification are untracked at inspection. Preserve all of them. Do not stage unrelated/untracked inputs or secrets.
- Local Phase 1 lint/build/browser checks were recorded on 2026-10-29. They are historical and must be rerun before a commit or deployment. Vercel preview is NOT RUN.

Recheck `git status --short` before every phase. Do not read, print, or paste `.env` or other secrets; if needed, inspect only presence and required variable names.

## Product scope and roles

### Roles

- **Admin:** controls account lifecycle and settings through server-side authorized operations.
- **Manager:** sees team pipeline and may assign/reassign and link duplicate leads.
- **Counsellor:** creates and manages leads they create or are assigned, and records interactions/follow-ups.

New users default to the least-privileged counsellor role. Users may not promote themselves or alter privileged roles through client-side requests.

### Proposed lead workflow

Stages proposed by the addendum: `New`, `Contacted`, `Counselling/Demo Done`, `Campus Visit`, `Applied`, `Enrolled`, `Lost`. This replaces the master prompt’s simpler `Qualified`/`Converted` model, subject to owner decision before migration. Lost requires `lost_reason`; entering Enrolled records `enrolled_at`. Preserve every transition in `lead_status_history`.

Normalize phone to E.164 and email to lowercase for duplicate detection. Validate required name/phone, optional email, trim inputs, use lookup tables for course/source if approved, and prefer `archived_at` over destructive deletion.

### KPI definitions

- Total leads: leads accessible under the current user’s RLS scope.
- New leads: accessible leads at `New`.
- Enrolled leads/conversion: pending decision on whether `Enrolled` replaces `Converted`; denominator is accessible leads, with zero handled safely.
- Overdue: accessible follow-ups whose state is pending and `due_at` is before current time.
- Dashboard totals reconcile against the same accessible list/query definitions; never show invented values as live.

## Architecture

```text
Browser: React + TypeScript + Vite
  -> routes and feature UI
  -> typed validation and data-access/service layer
  -> one public Supabase client
  -> Supabase Auth + PostgreSQL protected by RLS
  -> narrowly authorized Edge Functions for public intake/admin operations

GitHub -> Vercel preview (development Supabase project) -> separately gated production release
```

Keep database calls outside large UI components. Keep all privileged credentials server-side. Add a Vercel SPA fallback when routes are introduced. Preserve Phase 1 styling and patterns; no additional styling framework.

Potential additions, each justified at its phase:

- `@supabase/supabase-js`: required for the selected database/auth provider.
- TypeScript and type-check tooling: safer schema/service boundary and typed feature work.
- React Router: URL-backed feature screens and refreshable deep links.
- React Hook Form + Zod: consistent form state and shared input validation; validate again in Edge Functions/database.
- Vitest: unit/component tests for normalization, validation, status and metric rules.
- Supabase CLI and pgTAP: repeatable migration/type generation and direct policy tests.
- Playwright: later browser end-to-end coverage; defer if setup jeopardizes workshop scope.
- TanStack Query: defer until observed data-fetch/cache invalidation complexity justifies it.

Avoid adding chart, icon, styling, or animation libraries unless an implemented requirement clearly needs one.

## Schema and security design

All addendum schema decisions must be designed and reviewed in Phase 3 before applying the first migration. Later feature phases should not discover unplanned schema needs. The initial migration design must account for:

- Core `profiles`, `leads`, `follow_ups`, `activities`.
- Lead stage constraints, normalized contact values, `lost_reason`, `enrolled_at`, `archived_at`, consent/campaign/UTM and selected student/guardian/contact/priority/tag fields.
- `lead_status_history`, `lead_assignment_history`, courses/sources lookup tables, lead notes, typed interactions and outcomes, follow-up outcomes/rescheduling, audit records, tags/link table, `is_active`, `updated_at` triggers, useful foreign keys and indexes.
- Search/pagination indexing; attachments metadata and Storage bucket/policies only if that requirement remains approved.
- Duplicate check/link behavior, function grants, fixed safe `search_path`, and minimal returned data. The addendum requests matching existence plus owner name; disclose owner identity only if explicitly approved after privacy/security review.
- Organization/branch identifiers only if multi-branch is confirmed. Do not add them speculatively.

Tables/columns for later features may be provisioned in the initial reviewed migration, but their UI and workflows remain disabled until their feature phase. Every provisioned object needs a documented reason. The schema must use UUIDs, `timestamptz`, explicit constraints/FKs/delete behavior, and useful indexes.

RLS is mandatory on every client-exposed table and storage object. Review SELECT, INSERT, UPDATE (`USING` and `WITH CHECK`), and DELETE independently. Counsellor lead/follow-up/activity access is bounded by ownership or assignment; manager/admin team access is explicit. Profile roles cannot be changed through self-service. Never allow anonymous direct table writes for public intake. Server-side Admin API operations require Edge Function authorization, input validation, audit, and secrets in server environment only.

## Phase change log

| Existing plan | Amended direction |
|---|---|
| Phase 0 inspection | Retained; repeat read-only preflight and preserve dirty files. |
| Phase 1 visual shell | Retained; formalize current design spec and close out by review/commit, Vercel preview, and preview retest. |
| Phase 2 Supabase client/config | Split: TypeScript, routes, SPA rewrite and test foundation now precede database integration; client configuration/Auth follows schema. |
| Phase 3 schema/RLS | Expanded to include every accepted schema addition from the addendum before initial migration. |
| Phase 4 Auth | Retained; add `is_active`, Auth setting documentation, and controlled account lifecycle. |
| Phase 5 leads | Expanded to full admissions stages, Kanban, duplicate warning/linking, status/lost/enrollment history. |
| Phase 6 follow-ups/activity | Expanded with separate notes and typed interaction records; advanced follow-up features triaged separately. |
| Phase 7 dashboard/reports | Retained for truthful core metrics; advanced reports deferred. |
| Phases 8–9 quality/docs | Accessibility and tests become per-feature gates; CI, security hardening, privacy and operational docs move to final release phase. |
| Phase 10 deployment | Vercel preview is required after each feature; production is a separate, owner-authorized release gate. |
| New feature phases | Public intake/CSV and assignment/admin get distinct phases because of security, testing, and scope. |

## Per-feature plan and acceptance gates

Estimates: S = up to about half a day; M = about 1–2 days; L = more than 2 days, excluding provider/account delays.

| Phase | Goal and likely files | DB changes | RLS/security impact | Acceptance criteria | Test list |
|---|---|---|---|---|---|
| **0 — Preflight (complete)** | Inspect repo, scripts, Git state, and account prerequisites. | None. | Never read secret values; env check names only. | Baseline and dirty work identified; no changes overwritten. | `git status --short`, `git log -5 --oneline`, inventory source/config; record all account checks honestly. |
| **1 — Design spec and shell closeout (S)** | Document current design; preserve `src/App.jsx`, CSS and `index.html`; only fix verified defects. | None. | None; do not imply authentication. | Shell remains distinctive, accessible, responsive; review Phase 1 diff; commit intended files; authorized preview is deployed and retested. | Lint/build/diff check; all destinations; desktop/mobile, keyboard, reduced motion; preview URL smoke and refresh. |
| **2 — TypeScript, routing and testing foundation (M)** | Add TS incrementally, route views, shared feature/service/type structure, SPA rewrite. Files: package/lock, tsconfig, `src/main.tsx`, `src/App.tsx`, pages/features/types, `vercel.json`, test config. | None. | Route guards are UX only, not authz. | Current shell preserved; direct routes and refresh work locally and at Vercel preview; type-check is available. | Typecheck/lint/build; all routes; direct URL/refresh; mobile and reduced-motion regression. |
| **3 — Initial schema and RLS (L)** | Build/review repeatable migrations and generated DB types. Files: `supabase/migrations/`, optional CLI config, database types, SQL tests, schema docs. | All enumerated schema additions above; no later surprise tables/columns without approved migration. | RLS on every exposed table/storage bucket; role matrix; safe triggers/RPC grants; duplicate lookup not an enumeration endpoint. | Migration applies repeatably to dev; schema/types/policies agree; owner applies after review; policy behavior verified with ≥2 roles. | pgTAP/direct SQL SELECT/INSERT/UPDATE/DELETE; owner/role boundaries; RPC grants, fixed search path, forbidden calls; constraints/triggers/indexes; migration replay. |
| **4 — Supabase config and Auth (M)** | Client, config errors, sign-in/out/session/profile behavior, documented Auth settings. Files: `.env.example`, Supabase client, auth feature/hooks, README/tests. | Uses Phase 3 profiles and `is_active`. | Restrict profile access; no user role mutation; inactive access denied. | Missing vars fail clearly; valid/invalid auth, refresh/expiry, missing/inactive profile and counsellor default verified. | No-config, sign-in/out, session refresh, missing profile, forged role update, inactive account; local and preview. |
| **5 — Leads, pipeline and duplicates (L)** | CRUD/list/filter/pagination, Kanban, status history, Lost/enrollment rules, duplicate warnings and manager link. Files: `src/features/leads/`, services, validation, Kanban and tests. | Uses leads, stages, normalized contact, history, lost/enrolled fields, lookups, duplicate/link structures. | Counsellors see owned/assigned leads; team access manager/admin; function minimal output and grants; linking manager-only and preserves audit/children. | Create→refresh→search/filter→edit persists; statuses/history correct; Lost requires reason; Enrolled timestamp correct; duplicates detected; manager link safe. | E.164/email normalization, duplicate positive/negative/cross-owner, no enumeration, RPC authorization, pipeline invariants, link history, 10k pagination performance, preview retest. |
| **6 — Public intake and CSV (L; Later recommendation)** | Public form via Edge Function, CAPTCHA/honeypot/rate limit, CSV preview/import/export. Files: `supabase/functions/`, intake/import feature, validators/tests/docs. | Uses Phase 3 UTM/campaign/source fields and rate-control design. | No anonymous direct inserts; function validates and rate-limits; exports respect RLS; no service key in client. | Valid request creates lead; invalid/spam denied; import previews errors; export only returns authorized fields. | Abuse/rate limit, CAPTCHA/honeypot, malformed file/encoding, duplicate rows, partial failure, formula injection, unauthorized export, live preview. |
| **7 — Assignment and user administration (L; core assignment MVP)** | Manager assign/bulk reassign, safe deactivation/reassignment procedure; admin invite/role/deactivate only via protected Edge Function. Files: team/assignment UI, admin Edge Function, services/tests/docs. | Uses `lead_assignment_history`, `profiles.is_active`, audit records from Phase 3. | Manager-only assignment; admin operations server-side; role escalation denied; inactive users blocked; privileged actions audited. | Assignment traceable; bulk errors explicit; deactivation cannot orphan unaddressed leads; admin-only operations enforced. | RLS/role matrix, forged requests, bulk atomicity/partial failure, active sessions, deactivated users, reassignment, invite, role change, audit. |
| **8 — Follow-ups, notes and interactions (M)** | Create/update/complete/cancel follow-ups, lead timeline, notes and typed interactions. Files: follow-up/activity features, lead detail, services/tests. | Uses follow-ups, notes, interactions, outcomes/reschedule columns/tables from Phase 3. | Child rows inherit lead access; no direct table policy bypass. | Pending due-time rule correct; completed/cancelled excluded from overdue; history persists and is navigable. | Timezones/boundary; status changes; notes/interactions; direct child-table RLS; persistence; preview retest. |
| **9 — Dashboard and basic reports (M)** | Role-scoped real KPI cards and basic status/source summaries. Files: dashboard/reports, shared metrics/tests. | No new schema expected. | Aggregates return only RLS-visible records. | Metrics reconcile, use approved Enrolled/Converted definition, handle empty data and zero denominator; no hardcoded success. | Role fixtures, accessible totals, denominator, overdue, source/stage totals, empty/error, unauthorized aggregate, performance target. |
| **10 — Quality, operations and production release (L)** | CI, Dependabot decision, security headers/CSP, privacy/backup notes, final docs and production release. Files: `.github/workflows/`, dependency config, Vercel config, README/docs/tests. | Verify migration, audit, retention/erasure and backup strategy; avoid surprise schema changes. | Final RLS/security review, admin MFA, CSP origins, PII controls, rate limits; legal compliance requires qualified review. | CI passes; dev/prod projects and Vercel envs separate; restore/privacy guidance exists; performance measured; authorized live URL tested and reported only if observed. | Vitest, Playwright, pgTAP, type/lint/build, RLS matrix, CSP/security headers, 10k under-2s measurement, restore/runbook, final live auth/lead/follow-up/mobile regression. |

## Delivery loop for each feature

For each approved feature, proceed in this order: **develop → test locally → verify acceptance → review and commit scoped files → deploy Vercel preview → retest the deployed feature → proceed to next feature**. Record PASS/FAIL/NOT RUN and observed evidence. Fix failures before advancing.

The loop is gated by authorization for GitHub/Vercel/Supabase actions. Do not silently skip a commit or deployment; if blocked, report NOT RUN and get an explicit exception before advancing. Preview must use the development Supabase project. Production Supabase and Vercel settings are separate and only used at Phase 10 after owner authorization. Never include `.env`, secrets, the untracked master document, or unrelated work in a feature commit.

## Triage summary

The recommended two-day workshop MVP is: Auth, core lead pipeline/Kanban, duplicate warning and manager link, basic assignment, follow-ups/activity, role-scoped dashboard, RLS, and one verified deployment. Defer public intake/CAPTCHA, CSV, full admin console, round-robin, rich lead data, advanced interaction/follow-up/reporting, attachments, and integrations. Full line-by-line triage with effort and rationale is in [docs/spec-addendum.md](./docs/spec-addendum.md).

## Decisions required before Phase 3 migration

Plan approval does not answer these product decisions:

1. Is first release definitively single-branch? Recommendation: omit `organization_id`/`branch_id` unless multi-branch is likely now.
2. Should `Enrolled` replace `Converted` as terminal stage and conversion definition? Recommendation: yes.
3. What default country should guide phone entry/E.164 normalization, or should country code always be explicit?
4. May counsellors see matching lead owner name in duplicate warnings, or should identity be manager-only? Recommendation: counsellors get existence-only; manager may see owner.
5. Is public enquiry/CAPTCHA required for the two-day MVP? Recommendation: defer until authenticated lead workflows are complete.

## Planned commands and setup

Existing local commands:

```powershell
git status --short
git diff --check
npm run lint
npm run build
npm run dev
```

After their dependencies/scripts are approved, expected checks may include `npm run typecheck`, `npm run test`, `npx supabase gen types typescript --local`, `npx supabase db push`, and `npx playwright test`. Final script names depend on selected tooling. Apply reviewed migrations through SQL Editor or an explicitly authorized Supabase CLI flow. Never inspect `.env` contents; test only variable-name presence. GitHub push, provider login, Supabase migration, Vercel preview, and production deployment require owner authorization.

## Risks and safeguards

- A SECURITY DEFINER duplicate lookup can disclose cross-owner records or become an enumeration oracle. Fixed `search_path`, minimum grants, auth checks, minimal response, rate/abuse controls, and direct RPC tests are release gates. Owner name is sensitive and requires a decision.
- Packing every addendum structure into Phase 3 increases initial migration and review complexity; document purpose of each object and keep later feature behavior disabled.
- Stage semantics alter KPI definitions; resolve Enrolled vs Converted before migration.
- Student/guardian details, consent, notes, attachments, retention and deletion expand privacy risk. Minimize PII, use fictional workshop data, and seek qualified DPDP Act 2023/legal review before real-data production.
- Bulk/admin work may partially fail or orphan records; design transactionality, error reporting, audit and deactivation procedure.
- Public intake/CSV expands attack surface; validate server-side, rate-limit, prevent formula injection, and never permit anonymous direct writes.
- Separate dev/prod Supabase projects and Vercel environment scopes. Document free-tier pause behavior, region/cost, backups/restore, CSP, monitoring and incident ownership.
- Phase 1 work remains uncommitted with other untracked files. Review and stage only intended paths; live preview/deployment remains NOT RUN until observed.

## Future roadmap — documentation only

Enrolled lead → `students` table retaining `lead_id` FK → batches/courses → fees/invoices → attendance → WhatsApp/email integration. Do not implement this roadmap now. Do not add `organization_id`/`branch_id` until multi-branch need is confirmed.
