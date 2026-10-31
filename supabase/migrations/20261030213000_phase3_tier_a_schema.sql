begin;

-- Phase 3 Tier A assumptions for owner review:
-- 1. This is a single-branch CRM. Managers and admins can see every lead;
--    counsellors can see only leads they created or that are assigned to them.
-- 2. The application converts entered phone numbers to E.164. PostgreSQL
--    validates that representation but does not infer a country code.
-- 3. Email is trimmed and lower-cased in the database. Duplicate matching is
--    exact on normalized phone OR normalized email, and includes archived leads.
--    Duplicate checks are limited to 20 calls per user in a one-minute window
--    that resets one minute after the first call; this is a conservative
--    initial abuse-control assumption for owner review.
-- 4. Lost reasons are fixed codes. The CHECK constraint requires a code for
--    Lost; lost_note is optional. The code vocabulary is an initial product
--    assumption and can be changed only through a reviewed additive migration.
-- 5. Stage codes are stable API/database values; display labels belong to UI.
-- 6. A new Auth user receives a counsellor profile. Initial privileged role
--    bootstrap and later role changes must use an owner-controlled server-side
--    process; no client role-management endpoint is created in this migration.
-- 7. Consent fields capture only whether consent was given and its evidence
--    metadata; this schema does not define legal purpose or retention duration.
-- 8. Follow-up statuses are pending/completed/cancelled. Rescheduling is
--    counted when due_at changes; outcome is free text. No snooze, reminder,
--    calendar, or automatic follow-up structure is included.
-- 9. Activities and notes are append-only for authenticated clients. Managers
--    and admins can read the entire single-branch history.
-- 10. Duplicate links are non-destructive, canonical pairs. Manager/admin
--     access is provided only by the link RPC and manager/admin read policy.
-- 11. Auth users with lead references should be deactivated and reassigned,
--     not hard-deleted; restrictive profile FKs preserve attribution.
-- 12. Public intake, CAPTCHA, CSV, tags, attachments/Storage, generic audit
--     logging, advanced interactions, and Tier C features are out of scope.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'counsellor'
    check (role in ('admin', 'manager', 'counsellor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(btrim(code)) and code <> ''),
  name text not null check (btrim(name) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(btrim(code)) and code <> ''),
  name text not null check (btrim(name) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (btrim(full_name) <> ''),
  phone_e164 text not null
    check (phone_e164 ~ '^\+[1-9][0-9]{1,14}$'),
  email text,
  course_id uuid references public.courses (id) on delete set null,
  source_id uuid references public.lead_sources (id) on delete set null,
  stage_code text not null default 'new'
    check (stage_code in (
      'new',
      'contacted',
      'counselling_done',
      'campus_visit',
      'applied',
      'enrolled',
      'lost'
    )),
  lost_reason text
    check (lost_reason in (
      'not_interested',
      'no_response',
      'chose_competitor',
      'not_eligible',
      'other'
    )),
  lost_note text,
  enrolled_at timestamptz,
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete restrict,
  assigned_to uuid references public.profiles (id) on delete restrict,
  campaign_name text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  consent_given boolean,
  consent_at timestamptz,
  consent_source text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_lost_reason_required
    check (stage_code <> 'lost' or lost_reason is not null),
  constraint leads_consent_timestamp_required
    check (consent_given is distinct from true or consent_at is not null)
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  details text,
  due_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  outcome text,
  reschedule_count integer not null default 0 check (reschedule_count >= 0),
  completed_at timestamptz,
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_ups_completion_consistent
    check ((status = 'completed') = (completed_at is not null))
);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  body text not null check (btrim(body) <> ''),
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  summary text not null check (btrim(summary) <> ''),
  occurred_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  previous_stage_code text
    check (previous_stage_code in (
      'new',
      'contacted',
      'counselling_done',
      'campus_visit',
      'applied',
      'enrolled',
      'lost'
    )),
  new_stage_code text not null
    check (new_stage_code in (
      'new',
      'contacted',
      'counselling_done',
      'campus_visit',
      'applied',
      'enrolled',
      'lost'
    )),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

create table public.lead_assignment_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  previous_assignee_id uuid references public.profiles (id) on delete set null,
  new_assignee_id uuid references public.profiles (id) on delete set null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

create table public.duplicate_links (
  id uuid primary key default gen_random_uuid(),
  lead_low_id uuid not null references public.leads (id) on delete cascade,
  lead_high_id uuid not null references public.leads (id) on delete cascade,
  linked_by uuid not null references public.profiles (id) on delete restrict,
  linked_at timestamptz not null default now(),
  constraint duplicate_links_canonical_pair check (lead_low_id < lead_high_id),
  constraint duplicate_links_unique_pair unique (lead_low_id, lead_high_id)
);

create table public.lead_duplicate_check_windows (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  window_started_at timestamptz not null,
  check_count integer not null check (check_count > 0)
);

create index leads_created_by_created_at_idx
  on public.leads (created_by, created_at desc);
create index leads_assigned_to_created_at_idx
  on public.leads (assigned_to, created_at desc)
  where assigned_to is not null;
create index leads_stage_created_at_idx
  on public.leads (stage_code, created_at desc)
  where archived_at is null;
create index leads_phone_e164_idx on public.leads (phone_e164);
create index leads_email_idx on public.leads (email) where email is not null;
create index leads_source_id_created_at_idx
  on public.leads (source_id, created_at desc);
create index leads_course_id_created_at_idx
  on public.leads (course_id, created_at desc);
create index follow_ups_lead_due_at_idx
  on public.follow_ups (lead_id, due_at);
create index follow_ups_pending_due_at_idx
  on public.follow_ups (due_at)
  where status = 'pending';
create index lead_notes_lead_created_at_idx
  on public.lead_notes (lead_id, created_at desc);
create index activities_lead_occurred_at_idx
  on public.activities (lead_id, occurred_at desc);
create index lead_status_history_lead_changed_at_idx
  on public.lead_status_history (lead_id, changed_at desc);
create index lead_assignment_history_lead_changed_at_idx
  on public.lead_assignment_history (lead_id, changed_at desc);

create function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
    and p.is_active
$$;

create function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null
$$;

create function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('manager', 'admin'), false)
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create function public.normalize_lead_email_and_enrollment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is not null then
    new.email := nullif(pg_catalog.lower(pg_catalog.btrim(new.email)), '');
  end if;

  if new.stage_code = 'enrolled'
    and (tg_op = 'INSERT' or old.stage_code is distinct from new.stage_code)
    and new.enrolled_at is null then
    new.enrolled_at := pg_catalog.now();
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end
$$;

create function public.record_lead_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_status_history (
      lead_id, previous_stage_code, new_stage_code, changed_by
    ) values (new.id, null, new.stage_code, auth.uid());
  elsif old.stage_code is distinct from new.stage_code then
    insert into public.lead_status_history (
      lead_id, previous_stage_code, new_stage_code, changed_by
    ) values (new.id, old.stage_code, new.stage_code, auth.uid());
  end if;
  return new;
end
$$;

create function public.record_lead_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.assigned_to is distinct from new.assigned_to then
    insert into public.lead_assignment_history (
      lead_id, previous_assignee_id, new_assignee_id, changed_by
    ) values (new.id, old.assigned_to, new.assigned_to, auth.uid());
  end if;
  return new;
end
$$;

create function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and (
      new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
    ) then
    raise exception 'Profile role and active status require a protected server-side operation'
      using errcode = '42501';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

create function public.update_follow_up_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.due_at is distinct from old.due_at then
    new.reschedule_count := old.reschedule_count + 1;
  else
    new.reschedule_count := old.reschedule_count;
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, pg_catalog.now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end
$$;

create trigger auth_user_profile_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create trigger lead_sources_set_updated_at
  before update on public.lead_sources
  for each row execute function public.set_updated_at();

create trigger leads_normalize_email_and_enrollment
  before insert or update on public.leads
  for each row execute function public.normalize_lead_email_and_enrollment();

create trigger leads_record_stage_change
  after insert or update of stage_code on public.leads
  for each row execute function public.record_lead_stage_change();

create trigger leads_record_assignment_change
  after update of assigned_to on public.leads
  for each row execute function public.record_lead_assignment_change();

create trigger follow_ups_update_state
  before update on public.follow_ups
  for each row execute function public.update_follow_up_state();

create function public.check_lead_duplicate(
  p_phone_e164 text,
  p_email text default null
)
returns table (has_match boolean, owner_name text, rate_limited boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_check_count integer;
  normalized_email text := nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
  match_owner_name text;
begin
  if not public.is_active_app_user() then
    raise exception 'Active authenticated profile required'
      using errcode = '42501';
  end if;

  if p_phone_e164 is null
    or p_phone_e164 !~ '^\+[1-9][0-9]{1,14}$' then
    raise exception 'Phone input must already be normalized to E.164'
      using errcode = '22023';
  end if;

  insert into public.lead_duplicate_check_windows (
    user_id, window_started_at, check_count
  )
  values (caller_id, pg_catalog.now(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when public.lead_duplicate_check_windows.window_started_at
          <= pg_catalog.now() - interval '1 minute'
        then pg_catalog.now()
        else public.lead_duplicate_check_windows.window_started_at
      end,
      check_count = case
        when public.lead_duplicate_check_windows.window_started_at
          <= pg_catalog.now() - interval '1 minute'
        then 1
        else public.lead_duplicate_check_windows.check_count + 1
      end
  returning check_count into current_check_count;

  if current_check_count > 20 then
    return query select null::boolean, null::text, true;
    return;
  end if;

  select coalesce(
      assigned_profile.display_name,
      creator_profile.display_name,
      'Unknown owner'
    )
  into match_owner_name
  from public.leads as l
  left join public.profiles as assigned_profile on assigned_profile.id = l.assigned_to
  left join public.profiles as creator_profile on creator_profile.id = l.created_by
  where l.phone_e164 = p_phone_e164
     or (
       normalized_email is not null
       and l.email = normalized_email
     )
  order by l.created_at desc
  limit 1;

  if not found then
    return query select false, null::text, false;
  elsif public.current_app_role() = 'counsellor' then
    return query select true, null::text, false;
  elsif public.current_app_role() in ('manager', 'admin') then
    return query select true, match_owner_name, false;
  else
    raise exception 'Unsupported application role'
      using errcode = '42501';
  end if;
end
$$;

create function public.assign_lead(
  p_lead_id uuid,
  p_assignee_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_app_user()
    or public.current_app_role() not in ('manager', 'admin') then
    raise exception 'Manager or admin role required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = p_assignee_id
      and p.role = 'counsellor'
      and p.is_active
  ) then
    raise exception 'Assignee must be an active counsellor'
      using errcode = '22023';
  end if;

  update public.leads
  set assigned_to = p_assignee_id
  where id = p_lead_id;

  if not found then
    raise exception 'Lead not found'
      using errcode = 'P0002';
  end if;
end
$$;

create function public.link_duplicate_leads(
  p_first_lead_id uuid,
  p_second_lead_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  low_id uuid;
  high_id uuid;
  link_id uuid;
begin
  if not public.is_active_app_user()
    or not public.is_manager_or_admin() then
    raise exception 'Manager or admin role required'
      using errcode = '42501';
  end if;

  if p_first_lead_id is null
    or p_second_lead_id is null
    or p_first_lead_id = p_second_lead_id then
    raise exception 'Two distinct lead IDs are required'
      using errcode = '22023';
  end if;

  low_id := least(p_first_lead_id, p_second_lead_id);
  high_id := greatest(p_first_lead_id, p_second_lead_id);

  if not exists (select 1 from public.leads where id = low_id)
    or not exists (select 1 from public.leads where id = high_id) then
    raise exception 'Both leads must exist'
      using errcode = 'P0002';
  end if;

  insert into public.duplicate_links (lead_low_id, lead_high_id, linked_by)
  values (low_id, high_id, auth.uid())
  on conflict (lead_low_id, lead_high_id) do nothing
  returning id into link_id;

  if link_id is null then
    select id into link_id
    from public.duplicate_links
    where lead_low_id = low_id and lead_high_id = high_id;
  end if;

  return link_id;
end
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;
alter table public.follow_ups enable row level security;
alter table public.lead_notes enable row level security;
alter table public.activities enable row level security;
alter table public.lead_status_history enable row level security;
alter table public.lead_assignment_history enable row level security;
alter table public.duplicate_links enable row level security;
alter table public.lead_duplicate_check_windows enable row level security;

create policy profiles_select_visible
  on public.profiles for select to authenticated
  using (
    public.is_active_app_user()
    and (id = auth.uid() or public.is_manager_or_admin())
  );

create policy courses_select_visible
  on public.courses for select to authenticated
  using (
    public.is_active_app_user()
    and (is_active or public.is_manager_or_admin())
  );
create policy courses_manager_admin_insert
  on public.courses for insert to authenticated
  with check (public.is_active_app_user() and public.is_manager_or_admin());
create policy courses_manager_admin_update
  on public.courses for update to authenticated
  using (public.is_active_app_user() and public.is_manager_or_admin())
  with check (public.is_active_app_user() and public.is_manager_or_admin());
create policy courses_manager_admin_delete
  on public.courses for delete to authenticated
  using (public.is_active_app_user() and public.is_manager_or_admin());

create policy lead_sources_select_visible
  on public.lead_sources for select to authenticated
  using (
    public.is_active_app_user()
    and (is_active or public.is_manager_or_admin())
  );
create policy lead_sources_manager_admin_insert
  on public.lead_sources for insert to authenticated
  with check (public.is_active_app_user() and public.is_manager_or_admin());
create policy lead_sources_manager_admin_update
  on public.lead_sources for update to authenticated
  using (public.is_active_app_user() and public.is_manager_or_admin())
  with check (public.is_active_app_user() and public.is_manager_or_admin());
create policy lead_sources_manager_admin_delete
  on public.lead_sources for delete to authenticated
  using (public.is_active_app_user() and public.is_manager_or_admin());

create policy leads_select_visible
  on public.leads for select to authenticated
  using (
    public.is_active_app_user()
    and (
      public.is_manager_or_admin()
      or created_by = auth.uid()
      or assigned_to = auth.uid()
    )
  );
create policy leads_insert_counsellor_or_manager
  on public.leads for insert to authenticated
  with check (
    public.is_active_app_user()
    and created_by = auth.uid()
    and (
      public.is_manager_or_admin()
      or assigned_to is null
    )
  );
create policy leads_update_visible
  on public.leads for update to authenticated
  using (
    public.is_active_app_user()
    and (
      public.is_manager_or_admin()
      or created_by = auth.uid()
      or assigned_to = auth.uid()
    )
  )
  with check (
    public.is_active_app_user()
    and (
      public.is_manager_or_admin()
      or created_by = auth.uid()
      or assigned_to = auth.uid()
    )
  );

create policy follow_ups_select_visible
  on public.follow_ups for select to authenticated
  using (
    public.is_active_app_user()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  );
create policy follow_ups_insert_visible
  on public.follow_ups for insert to authenticated
  with check (
    public.is_active_app_user()
    and created_by = auth.uid()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  );
create policy follow_ups_update_visible
  on public.follow_ups for update to authenticated
  using (
    public.is_active_app_user()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  )
  with check (
    public.is_active_app_user()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  );

create policy lead_notes_select_visible
  on public.lead_notes for select to authenticated
  using (
    public.is_active_app_user()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  );
create policy lead_notes_insert_visible
  on public.lead_notes for insert to authenticated
  with check (
    public.is_active_app_user()
    and created_by = auth.uid()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  );

create policy activities_select_visible
  on public.activities for select to authenticated
  using (
    public.is_active_app_user()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  );
create policy activities_insert_visible
  on public.activities for insert to authenticated
  with check (
    public.is_active_app_user()
    and created_by = auth.uid()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  );

create policy lead_status_history_select_visible
  on public.lead_status_history for select to authenticated
  using (
    public.is_active_app_user()
    and exists (select 1 from public.leads as l where l.id = lead_id)
  );

create policy lead_assignment_history_manager_admin_select
  on public.lead_assignment_history for select to authenticated
  using (public.is_active_app_user() and public.is_manager_or_admin());

create policy duplicate_links_manager_admin_select
  on public.duplicate_links for select to authenticated
  using (public.is_active_app_user() and public.is_manager_or_admin());

revoke all on table
  public.profiles,
  public.courses,
  public.lead_sources,
  public.leads,
  public.follow_ups,
  public.lead_notes,
  public.activities,
  public.lead_status_history,
  public.lead_assignment_history,
  public.duplicate_links,
  public.lead_duplicate_check_windows
from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.courses, public.lead_sources
  to authenticated;
grant select on public.leads to authenticated;
grant insert (
  full_name,
  phone_e164,
  email,
  course_id,
  source_id,
  campaign_name,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content,
  consent_given,
  consent_at,
  consent_source
) on public.leads to authenticated;
grant update (
  full_name,
  phone_e164,
  email,
  course_id,
  source_id,
  stage_code,
  lost_reason,
  lost_note,
  campaign_name,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content,
  consent_given,
  consent_at,
  consent_source,
  archived_at
) on public.leads to authenticated;

grant select on public.follow_ups to authenticated;
grant insert (lead_id, title, details, due_at, outcome)
  on public.follow_ups to authenticated;
grant update (title, details, due_at, status, outcome)
  on public.follow_ups to authenticated;

grant select on public.lead_notes, public.activities to authenticated;
grant insert (lead_id, body) on public.lead_notes to authenticated;
grant insert (lead_id, summary, occurred_at) on public.activities to authenticated;
grant select on public.lead_status_history, public.lead_assignment_history,
  public.duplicate_links to authenticated;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_active_app_user() from public, anon;
revoke all on function public.is_manager_or_admin() from public, anon;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.normalize_lead_email_and_enrollment()
  from public, anon, authenticated;
revoke all on function public.record_lead_stage_change()
  from public, anon, authenticated;
revoke all on function public.record_lead_assignment_change()
  from public, anon, authenticated;
revoke all on function public.protect_profile_privileges()
  from public, anon, authenticated;
revoke all on function public.update_follow_up_state()
  from public, anon, authenticated;
revoke all on function public.check_lead_duplicate(text, text) from public, anon;
revoke all on function public.assign_lead(uuid, uuid) from public, anon;
revoke all on function public.link_duplicate_leads(uuid, uuid) from public, anon;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_app_user() to authenticated;
grant execute on function public.is_manager_or_admin() to authenticated;
grant execute on function public.check_lead_duplicate(text, text) to authenticated;
grant execute on function public.assign_lead(uuid, uuid) to authenticated;
grant execute on function public.link_duplicate_leads(uuid, uuid) to authenticated;

comment on table public.profiles is
  'Auth-linked profile; client roles and active state are not user-editable.';
comment on table public.leads is
  'Single-branch leads. Managers/admins see all; counsellors see created or assigned leads.';
comment on table public.lead_status_history is
  'Database-maintained append-only stage history; labels are rendered by the application.';
comment on table public.lead_assignment_history is
  'Database-maintained assignment history; visible only to managers and admins.';
comment on table public.duplicate_links is
  'Non-destructive manager/admin links between potential duplicate leads.';
comment on column public.leads.created_by is
  'Set from auth.uid() on insert; authenticated INSERT/UPDATE grants omit this column.';
comment on column public.leads.assigned_to is
  'Authenticated clients cannot write this column; manager/admin assignment uses assign_lead().';
comment on column public.profiles.role is
  'No authenticated UPDATE grant; trigger rejects authenticated role changes.';
comment on column public.profiles.is_active is
  'No authenticated UPDATE grant; trigger rejects authenticated active-state changes.';
comment on table public.lead_duplicate_check_windows is
  'Private SECURITY DEFINER rate-limit state; no client table access.';
comment on function public.check_lead_duplicate(text, text) is
  'Exact normalized phone/email lookup including archived leads; counsellors receive existence only; returns rate-limit state.';
comment on function public.assign_lead(uuid, uuid) is
  'Manager/admin-only assignment to an active counsellor; assignment history is recorded by trigger.';
comment on function public.link_duplicate_leads(uuid, uuid) is
  'Manager/admin-only idempotent non-destructive link; does not merge or delete leads.';

commit;
