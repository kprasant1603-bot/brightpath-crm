-- Manual SQL Editor test for a disposable development project only.
-- First create three users in Supabase Dashboard > Authentication:
--   phase3-admin@example.test
--   phase3-manager@example.test
--   phase3-counsellor@example.test
-- The auth trigger in the migration creates their counsellor profiles.
-- Replace these three example addresses below with the addresses you created.
-- This script does not create Auth users. It temporarily assigns fixture roles
-- and creates clearly fictional data, then rolls all test data back.
-- It checks table/column grants for every table, runtime RLS for lead and
-- dependent-record access, protected fields, RPC authorization and anonymous
-- function/table privileges. It is not a substitute for testing every UI path.
--
-- Run only after reviewing and applying the migration to the development project.
-- Running in a SQL Editor session requires permission to SET ROLE authenticated
-- and access to the Auth/profile tables as the database owner.

begin;

create temporary table phase3_test_user_ids (
  test_role text primary key,
  user_id uuid not null unique
) on commit drop;

insert into phase3_test_user_ids (test_role, user_id)
select expected.test_role, auth_user.id
from (
  values
    ('admin', 'phase3-admin@example.test'),
    ('manager', 'phase3-manager@example.test'),
    ('counsellor', 'phase3-counsellor@example.test')
) as expected(test_role, email)
join auth.users as auth_user on lower(auth_user.email) = expected.email;

do $$
begin
  if (select count(*) from phase3_test_user_ids) <> 3 then
    raise exception
      'Create the three dashboard test users and update the example emails before running';
  end if;
end
$$;

-- Fixture-only privileged role setup. This runs as the SQL Editor owner, not as
-- an application user. Never expose this role assignment as a client operation.
do $$
begin
  if auth.uid() is not null then
    raise exception 'Run fixture role setup as SQL Editor owner with auth.uid() NULL';
  end if;
end
$$;
update public.profiles as p
set role = u.test_role,
    display_name = case u.test_role
      when 'admin' then 'Fictional Test Admin'
      when 'manager' then 'Fictional Test Manager'
      else 'Fictional Test Counsellor'
    end
from phase3_test_user_ids as u
where p.id = u.user_id;
select set_config(
  'phase3.manager_id',
  (select user_id::text from phase3_test_user_ids where test_role = 'manager'),
  true
);

insert into public.leads (
  id, full_name, phone_e164, email, stage_code, created_by, assigned_to,
  archived_at
)
select
  '10000000-0000-4000-8000-000000000001',
  'Fictional Created Lead',
  '+919876540001',
  'CREATED@EXAMPLE.TEST',
  'new',
  counsellor.user_id,
  null,
  null
from phase3_test_user_ids as counsellor
where counsellor.test_role = 'counsellor';

insert into public.leads (
  id, full_name, phone_e164, email, stage_code, created_by, assigned_to,
  archived_at
)
select
  '10000000-0000-4000-8000-000000000002',
  'Fictional Assigned Lead',
  '+919876540002',
  'assigned@example.test',
  'contacted',
  manager.user_id,
  counsellor.user_id,
  null
from phase3_test_user_ids as manager
cross join phase3_test_user_ids as counsellor
where manager.test_role = 'manager'
  and counsellor.test_role = 'counsellor';

insert into public.leads (
  id, full_name, phone_e164, email, stage_code, lost_reason, lost_note,
  created_by, assigned_to, archived_at
)
select
  '10000000-0000-4000-8000-000000000003',
  'Fictional Archived Lead',
  '+919876540003',
  'archived@example.test',
  'lost',
  'no_response',
  'Fictional test fixture.',
  manager.user_id,
  null,
  now()
from phase3_test_user_ids as manager
where manager.test_role = 'manager';

insert into public.leads (
  id, full_name, phone_e164, email, stage_code, created_by, assigned_to,
  archived_at
)
select
  '10000000-0000-4000-8000-000000000004',
  'Fictional Counsellor Archive Flow',
  '+919876540004',
  'archive-flow@example.test',
  'new',
  counsellor.user_id,
  null,
  null
from phase3_test_user_ids as counsellor
where counsellor.test_role = 'counsellor';

insert into public.courses (id, code, name)
values ('30000000-0000-4000-8000-000000000001', 'fictional-course', 'Fictional Course');
insert into public.lead_sources (id, code, name)
values ('40000000-0000-4000-8000-000000000001', 'fictional-source', 'Fictional Source');

do $$
begin
  if (select email from public.leads
      where id = '10000000-0000-4000-8000-000000000001')
      <> 'created@example.test' then
    raise exception 'Lead email must be trimmed and lower-cased by trigger';
  end if;

  if not exists (
    select 1 from public.lead_status_history
    where lead_id = '10000000-0000-4000-8000-000000000001'
      and previous_stage_code is null
      and new_stage_code = 'new'
  ) then
    raise exception 'Lead creation must record its initial stage';
  end if;

  begin
    insert into public.leads (
      full_name, phone_e164, stage_code, created_by
    ) values (
      'Fictional Invalid Phone',
      '9876543210',
      'new',
      (select user_id from phase3_test_user_ids where test_role = 'manager')
    );
    raise exception 'Invalid E.164 phone was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.leads (
      full_name, phone_e164, stage_code, created_by
    ) values (
      'Fictional Lost Without Reason',
      '+919876549999',
      'lost',
      (select user_id from phase3_test_user_ids where test_role = 'manager')
    );
    raise exception 'Lost lead without a reason was accepted';
  exception when check_violation then
    null;
  end;
end
$$;

insert into public.follow_ups (id, lead_id, title, due_at, created_by)
select
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Fictional counsellor follow-up',
  now() + interval '1 day',
  counsellor.user_id
from phase3_test_user_ids as counsellor
where counsellor.test_role = 'counsellor';

insert into public.lead_notes (id, lead_id, body, created_by)
select
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Fictional note fixture.',
  counsellor.user_id
from phase3_test_user_ids as counsellor
where counsellor.test_role = 'counsellor';

insert into public.activities (id, lead_id, summary, created_by)
select
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Fictional activity fixture.',
  counsellor.user_id
from phase3_test_user_ids as counsellor
where counsellor.test_role = 'counsellor';

-- Managers/admins archive and restore through the protected RPC. This checks
-- that direct clients need not receive UPDATE access to archived_at.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'manager'),
  true
);
set local role authenticated;
select public.set_lead_archived(
  '10000000-0000-4000-8000-000000000004', true
);
do $$
begin
  if not exists (
    select 1 from public.leads
    where id = '10000000-0000-4000-8000-000000000004'
      and archived_at is not null
  ) then
    raise exception 'Manager archive RPC did not archive the lead';
  end if;
end
$$;
select public.set_lead_archived(
  '10000000-0000-4000-8000-000000000004', false
);
do $$
begin
  if not exists (
    select 1 from public.leads
    where id = '10000000-0000-4000-8000-000000000004'
      and archived_at is null
  ) then
    raise exception 'Manager archive RPC did not restore the lead';
  end if;
end
$$;
select public.set_lead_archived(
  '10000000-0000-4000-8000-000000000004', true
);
reset role;

-- Admins retain the same archive/restore capability.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'admin'),
  true
);
set local role authenticated;
select public.set_lead_archived(
  '10000000-0000-4000-8000-000000000004', false
);
select public.set_lead_archived(
  '10000000-0000-4000-8000-000000000004', true
);
do $$
declare
  duplicate_result record;
begin
  select * into duplicate_result
  from public.check_lead_duplicate('+919876540003', 'ARCHIVED@EXAMPLE.TEST');
  if duplicate_result.has_match is distinct from true
    or duplicate_result.owner_name is not null then
    raise exception 'Admin duplicate response must not disclose owner identity';
  end if;
end
$$;
reset role;

-- Manager and admin must each see all four leads, including archived leads.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'manager'),
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.leads) <> 4 then
    raise exception 'Manager must see every lead in the single branch';
  end if;

  if (select count(*) from public.profiles) <> 3
    or (select count(*) from public.courses) <> 1
    or (select count(*) from public.lead_sources) <> 1
    or (select count(*) from public.follow_ups) <> 1
    or (select count(*) from public.lead_notes) <> 1
    or (select count(*) from public.activities) <> 1
    or (select count(*) from public.lead_status_history) <> 4 then
    raise exception 'Manager SELECT access to Tier A tables is incorrect';
  end if;
end
$$;
reset role;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'admin'),
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.leads) <> 4 then
    raise exception 'Admin must see every lead in the single branch';
  end if;

  if (select count(*) from public.profiles) <> 3
    or (select count(*) from public.courses) <> 1
    or (select count(*) from public.lead_sources) <> 1
    or (select count(*) from public.follow_ups) <> 1
    or (select count(*) from public.lead_notes) <> 1
    or (select count(*) from public.activities) <> 1
    or (select count(*) from public.lead_status_history) <> 4 then
    raise exception 'Admin SELECT access to Tier A tables is incorrect';
  end if;
end
$$;
reset role;

-- Counsellor sees only created/assigned active leads; archived rows are hidden.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'counsellor'),
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.leads) <> 2 then
    raise exception 'Counsellor must see only leads created or assigned to them';
  end if;

  if (select count(*) from public.profiles) <> 1
    or (select count(*) from public.courses) <> 1
    or (select count(*) from public.lead_sources) <> 1
    or (select count(*) from public.follow_ups) <> 1
    or (select count(*) from public.lead_notes) <> 1
    or (select count(*) from public.activities) <> 1
    or (select count(*) from public.lead_status_history) <> 2
    or (select count(*) from public.lead_assignment_history) <> 0
    or (select count(*) from public.duplicate_links) <> 0 then
    raise exception 'Counsellor SELECT access to Tier A tables is incorrect';
  end if;

  if exists (
    select 1
    from public.leads
    where id = '10000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Counsellor must not see an unrelated archived lead';
  end if;

  if exists (
    select 1 from public.leads
    where id = '10000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'Counsellor must not read an archived lead they created';
  end if;

  update public.leads
  set full_name = 'Fictional Unauthorized Edit'
  where id = '10000000-0000-4000-8000-000000000003';
  if found then
    raise exception 'Counsellor updated another user''s lead';
  end if;

  update public.leads
  set full_name = 'Fictional Unauthorized Archived Edit'
  where id = '10000000-0000-4000-8000-000000000004';
  if found then
    raise exception 'Counsellor updated their archived lead';
  end if;

  update public.follow_ups
  set due_at = due_at + interval '1 day'
  where id = '20000000-0000-4000-8000-000000000001';

  if (select reschedule_count from public.follow_ups
      where id = '20000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Changing follow-up due time must increment reschedule_count';
  end if;

  insert into public.leads (full_name, phone_e164, email)
  values ('Fictional Counsellor CRUD Lead', '+919876549997', '  CRUD@EXAMPLE.TEST  ');
  if not found then
    raise exception 'Counsellor could not INSERT an owned lead';
  end if;
  if not exists (
    select 1 from public.leads
    where phone_e164 = '+919876549997'
      and email = 'crud@example.test'
  ) then
    raise exception 'Lead email was not trimmed and lower-cased';
  end if;

  update public.leads
  set full_name = 'Fictional Counsellor CRUD Lead Updated'
  where phone_e164 = '+919876549997';
  if not found then
    raise exception 'Counsellor could not UPDATE an owned active lead';
  end if;

  begin
    delete from public.leads where phone_e164 = '+919876549997';
    raise exception 'Counsellor unexpectedly DELETEd a lead';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.lead_notes (lead_id, body)
  values (
    '10000000-0000-4000-8000-000000000001',
    'Fictional counsellor-created note.'
  );
  insert into public.activities (lead_id, summary)
  values (
    '10000000-0000-4000-8000-000000000001',
    'Fictional counsellor-created activity.'
  );

  begin
    update public.lead_notes set body = 'Attempted edit'
    where id = '50000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly UPDATEd a note';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.activities
    where id = '60000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly DELETEd an activity';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.courses (code, name)
    values ('counsellor-forbidden', 'Forbidden Course');
    raise exception 'Counsellor unexpectedly INSERTed a course';
  exception when insufficient_privilege then
    null;
  end;

  delete from public.courses
  where id = '30000000-0000-4000-8000-000000000001';
  if found then
    raise exception 'Counsellor unexpectedly DELETEd a course';
  end if;

  begin
    insert into public.lead_sources (code, name)
    values ('counsellor-forbidden', 'Forbidden Source');
    raise exception 'Counsellor unexpectedly INSERTed a lead source';
  exception when insufficient_privilege then
    null;
  end;

  update public.lead_sources set name = 'Forbidden Edit'
  where id = '40000000-0000-4000-8000-000000000001';
  if found then
    raise exception 'Counsellor unexpectedly UPDATEd a lead source';
  end if;

  update public.courses set name = 'Forbidden Edit'
  where id = '30000000-0000-4000-8000-000000000001';
  if found then
    raise exception 'Counsellor unexpectedly UPDATEd a course';
  end if;

  delete from public.lead_sources
  where id = '40000000-0000-4000-8000-000000000001';
  if found then
    raise exception 'Counsellor unexpectedly DELETEd a lead source';
  end if;

  begin
    insert into public.profiles (id, role, is_active)
    values (auth.uid(), 'admin', true);
    raise exception 'Counsellor unexpectedly INSERTed a profile';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.profiles where id = auth.uid();
    raise exception 'Counsellor unexpectedly DELETEd a profile';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.assign_lead(
      '10000000-0000-4000-8000-000000000001',
      auth.uid()
    );
    raise exception 'Counsellor unexpectedly assigned a lead';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.lead_duplicate_check_log
    set checked_at = now()
    where user_id = auth.uid();
    raise exception 'Counsellor unexpectedly UPDATEd duplicate-check logs';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.lead_duplicate_check_log
    where user_id = auth.uid();
    raise exception 'Counsellor unexpectedly DELETEd duplicate-check logs';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

-- Protected lead columns must be rejected by SQL privileges.
do $$
begin
  begin
    insert into public.leads (
      full_name, phone_e164, stage_code, created_by
    ) values (
      'Fictional Forged Creator',
      '+919876549998',
      'new',
      current_setting('phase3.manager_id')::uuid
    );
    raise exception 'Counsellor unexpectedly created a lead for another user';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.leads
    set assigned_to = null
    where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly changed assigned_to';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.leads
    set created_by = null
    where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly changed created_by';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.profiles
    set role = 'admin'
    where id = auth.uid();
    raise exception 'Counsellor unexpectedly changed profile role';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.profiles
    set is_active = false
    where id = auth.uid();
    raise exception 'Counsellor unexpectedly changed is_active';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.lead_status_history (
      lead_id, previous_stage_code, new_stage_code, changed_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'new',
      'contacted',
      auth.uid()
    );
    raise exception 'Counsellor unexpectedly inserted status history';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.lead_status_history
    set new_stage_code = 'lost'
    where lead_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly edited status history';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.lead_status_history
    where lead_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly deleted status history';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.lead_assignment_history (
      lead_id, new_assignee_id, changed_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      auth.uid(),
      auth.uid()
    );
    raise exception 'Counsellor unexpectedly inserted assignment history';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.lead_assignment_history
    set new_assignee_id = null
    where lead_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly edited assignment history';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.lead_assignment_history
    where lead_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly deleted assignment history';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

-- Counsellor duplicate lookup includes archived leads but discloses no owner.
do $$
declare
  duplicate_result record;
  check_number integer;
begin
  select * into duplicate_result
  from public.check_lead_duplicate('+919876540003', 'ARCHIVED@EXAMPLE.TEST');
  if duplicate_result.has_match is distinct from true
    or duplicate_result.owner_name is not null
    or duplicate_result.rate_limited is distinct from false then
    raise exception 'Counsellor duplicate response must be existence-only';
  end if;

  select * into duplicate_result
  from public.check_lead_duplicate('+919876549995', 'created@example.test.extra');
  if duplicate_result.has_match is distinct from false
    or duplicate_result.rate_limited is distinct from false
    or duplicate_result.invalid_input is distinct from false then
    raise exception 'Duplicate lookup must use exact, not partial, email matching';
  end if;

  select * into duplicate_result
  from public.check_lead_duplicate('not-e164', null);
  if duplicate_result.invalid_input is distinct from true
    or duplicate_result.rate_limited is distinct from false then
    raise exception 'Invalid duplicate-check inputs must be logged and rejected';
  end if;

  for check_number in 1..20 loop
    select * into duplicate_result
    from public.check_lead_duplicate('+919876540003', 'ARCHIVED@EXAMPLE.TEST');
  end loop;

  if duplicate_result.rate_limited is distinct from true
    or duplicate_result.has_match is not null
    or duplicate_result.invalid_input is distinct from false then
    raise exception 'Duplicate lookup must return an explicit rate-limited result';
  end if;
end
$$;

do $$
begin
  if has_column_privilege(
    'authenticated', 'public.leads', 'created_by', 'INSERT'
  ) or has_column_privilege(
    'authenticated', 'public.leads', 'created_by', 'UPDATE'
  ) or has_column_privilege(
    'authenticated', 'public.leads', 'assigned_to', 'INSERT'
  ) or has_column_privilege(
    'authenticated', 'public.leads', 'assigned_to', 'UPDATE'
  ) or has_column_privilege(
    'authenticated', 'public.leads', 'archived_at', 'UPDATE'
  ) or has_column_privilege(
    'authenticated', 'public.profiles', 'role', 'UPDATE'
  ) or has_column_privilege(
    'authenticated', 'public.profiles', 'is_active', 'UPDATE'
  ) then
    raise exception 'A protected ownership, archive, role, or active field has a direct client grant';
  end if;
end
$$;

-- A counsellor cannot use manager-only assignment, link, or archive RPCs.
do $$
begin
  begin
    perform public.assign_lead(
      '10000000-0000-4000-8000-000000000001',
      auth.uid()
    );
    raise exception 'Counsellor unexpectedly used assignment RPC';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.link_duplicate_leads(
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002'
    );
    raise exception 'Counsellor unexpectedly used duplicate-link RPC';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.set_lead_archived(
      '10000000-0000-4000-8000-000000000001',
      true
    );
    raise exception 'Counsellor unexpectedly used archive RPC';
  exception when insufficient_privilege then
    null;
  end;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lead_duplicate_check_log'
      and column_name in ('phone', 'email', 'phone_hash', 'email_hash', 'match_result')
  ) then
    raise exception 'Duplicate check log must not store contact data or match results';
  end if;

  begin
    perform count(*) from public.lead_duplicate_check_windows;
    raise exception 'Counsellor unexpectedly read rate-limit state';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.lead_duplicate_check_windows (
      user_id, minute_window_started_at, minute_check_count,
      daily_window_date, daily_check_count
    ) values (auth.uid(), now(), 1, (now() at time zone 'UTC')::date, 1);
    raise exception 'Counsellor unexpectedly wrote rate-limit state';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform count(*) from public.lead_duplicate_check_log;
    raise exception 'Counsellor unexpectedly read duplicate check log';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.duplicate_links (
      lead_low_id, lead_high_id, linked_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      auth.uid()
    );
    raise exception 'Counsellor unexpectedly inserted a duplicate link';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.duplicate_links
    set linked_at = now()
    where lead_low_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly edited a duplicate link';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.duplicate_links
    where lead_low_id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Counsellor unexpectedly deleted a duplicate link';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

-- Manager duplicate lookup includes archived leads and can identify the owner.
select set_config(
  'phase3.counsellor_id',
  (select user_id::text from phase3_test_user_ids where test_role = 'counsellor'),
  true
);
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'manager'),
  true
);
set local role authenticated;
do $$
declare
  duplicate_result record;
begin
  select * into duplicate_result
  from public.check_lead_duplicate('+919876540003', 'ARCHIVED@EXAMPLE.TEST');
  if duplicate_result.has_match is distinct from true
    or duplicate_result.owner_name is null
    or duplicate_result.owner_name <> 'Fictional Test Manager'
    or duplicate_result.rate_limited is distinct from false
    or duplicate_result.invalid_input is distinct from false then
    raise exception 'Manager duplicate response must include matching owner identity';
  end if;
end
$$;

-- Daily cap: owner-context fixture setup moves this user's counter to 199.
reset role;
update public.lead_duplicate_check_windows
set minute_window_started_at = now() - interval '2 minutes',
    minute_check_count = 1,
    daily_window_date = (now() at time zone 'UTC')::date,
    daily_check_count = 199
where user_id = (select user_id from phase3_test_user_ids where test_role = 'manager');
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'manager'),
  true
);
set local role authenticated;
do $$
declare
  duplicate_result record;
begin
  select * into duplicate_result
  from public.check_lead_duplicate('+919876540003', null);
  if duplicate_result.rate_limited is distinct from false then
    raise exception 'The 200th daily duplicate check should be permitted';
  end if;

  select * into duplicate_result
  from public.check_lead_duplicate('+919876540003', null);
  if duplicate_result.rate_limited is distinct from true
    or duplicate_result.has_match is not null
    or duplicate_result.invalid_input is distinct from false then
    raise exception 'The 201st daily duplicate check should be rate-limited';
  end if;
end
$$;
reset role;
do $$
begin
  if (select count(*) from public.lead_duplicate_check_log
      where user_id = current_setting('phase3.counsellor_id')::uuid) <> 23 then
    raise exception 'Each valid duplicate check must create one metadata log row';
  end if;
end
$$;

-- Assignment RPC is manager-only, and its update must create a history row.
select set_config(
  'request.jwt.claim.sub',
  current_setting('phase3.manager_id'),
  true
);
set local role authenticated;
select public.assign_lead(
  '10000000-0000-4000-8000-000000000003',
  current_setting('phase3.counsellor_id')::uuid
);
do $$
begin
  if not exists (
    select 1 from public.lead_assignment_history
    where lead_id = '10000000-0000-4000-8000-000000000003'
      and new_assignee_id = (
        current_setting('phase3.counsellor_id')::uuid
      )
  ) then
    raise exception 'Manager assignment must be recorded in history';
  end if;
end
$$;

update public.leads
set stage_code = 'enrolled'
where id = '10000000-0000-4000-8000-000000000002';
do $$
begin
  if not exists (
    select 1 from public.leads
    where id = '10000000-0000-4000-8000-000000000002'
      and enrolled_at is not null
  ) then
    raise exception 'Entering Enrolled must set enrolled_at';
  end if;

  if not exists (
    select 1 from public.lead_status_history
    where lead_id = '10000000-0000-4000-8000-000000000002'
      and previous_stage_code = 'contacted'
      and new_stage_code = 'enrolled'
  ) then
    raise exception 'Stage change must append lead status history';
  end if;
end
$$;

-- Manager can link, but cannot destructively merge, the archived fixture.
select public.link_duplicate_leads(
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003'
);
do $$
begin
  if (select count(*) from public.duplicate_links) <> 1 then
    raise exception 'Manager duplicate link was not recorded';
  end if;
end
$$;

-- Manager-only lookup-table CRUD is permitted; keep fixture operations reversible.
insert into public.courses (id, code, name)
values ('30000000-0000-4000-8000-000000000002', 'manager-course', 'Manager Course');
update public.courses
set name = 'Manager Course Updated'
where id = '30000000-0000-4000-8000-000000000002';
delete from public.courses
where id = '30000000-0000-4000-8000-000000000002';
insert into public.lead_sources (id, code, name)
values ('40000000-0000-4000-8000-000000000002', 'manager-source', 'Manager Source');
update public.lead_sources
set name = 'Manager Source Updated'
where id = '40000000-0000-4000-8000-000000000002';
delete from public.lead_sources
where id = '40000000-0000-4000-8000-000000000002';

insert into public.leads (full_name, phone_e164, stage_code)
values ('Fictional Manager CRUD Lead', '+919876549996', 'new');
update public.leads
set full_name = 'Fictional Manager CRUD Lead Updated'
where phone_e164 = '+919876549996';
do $$
begin
  begin
    delete from public.leads where phone_e164 = '+919876549996';
    raise exception 'Manager unexpectedly DELETEd a lead';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

insert into public.follow_ups (
  lead_id, title, due_at
)
values (
  '10000000-0000-4000-8000-000000000003',
  'Fictional manager follow-up',
  now() + interval '2 days'
);
update public.follow_ups
set outcome = 'Fictional outcome'
where title = 'Fictional manager follow-up';
do $$
begin
  begin
    delete from public.follow_ups
    where title = 'Fictional manager follow-up';
    raise exception 'Manager unexpectedly DELETEd a follow-up';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

insert into public.lead_notes (lead_id, body)
values (
  '10000000-0000-4000-8000-000000000003',
  'Fictional manager-created note.'
);
insert into public.activities (lead_id, summary)
values (
  '10000000-0000-4000-8000-000000000003',
  'Fictional manager-created activity.'
);
do $$
begin
  begin
    update public.lead_notes set body = 'Attempted manager edit'
    where body = 'Fictional manager-created note.';
    raise exception 'Manager unexpectedly edited a note';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.activities
    where summary = 'Fictional manager-created activity.';
    raise exception 'Manager unexpectedly deleted an activity';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.profiles set role = 'admin'
    where id = auth.uid();
    raise exception 'Manager unexpectedly changed profile role';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.profiles set is_active = false
    where id = auth.uid();
    raise exception 'Manager unexpectedly changed profile active status';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

-- Admin must also be authorized to link duplicates.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'admin'),
  true
);
set local role authenticated;
insert into public.courses (id, code, name)
values ('30000000-0000-4000-8000-000000000003', 'admin-course', 'Admin Course');
update public.courses
set name = 'Admin Course Updated'
where id = '30000000-0000-4000-8000-000000000003';
delete from public.courses
where id = '30000000-0000-4000-8000-000000000003';
insert into public.lead_sources (id, code, name)
values ('40000000-0000-4000-8000-000000000003', 'admin-source', 'Admin Source');
update public.lead_sources
set name = 'Admin Source Updated'
where id = '40000000-0000-4000-8000-000000000003';
delete from public.lead_sources
where id = '40000000-0000-4000-8000-000000000003';

insert into public.leads (full_name, phone_e164, stage_code)
values ('Fictional Admin CRUD Lead', '+919876549994', 'new');
update public.leads
set full_name = 'Fictional Admin CRUD Lead Updated'
where phone_e164 = '+919876549994';
do $$
begin
  begin
    delete from public.leads where phone_e164 = '+919876549994';
    raise exception 'Admin unexpectedly DELETEd a lead';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

insert into public.follow_ups (lead_id, title, due_at)
values (
  '10000000-0000-4000-8000-000000000003',
  'Fictional admin follow-up',
  now() + interval '2 days'
);
update public.follow_ups
set outcome = 'Fictional admin outcome'
where title = 'Fictional admin follow-up';
do $$
begin
  begin
    delete from public.follow_ups
    where title = 'Fictional admin follow-up';
    raise exception 'Admin unexpectedly DELETEd a follow-up';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

insert into public.lead_notes (lead_id, body)
values (
  '10000000-0000-4000-8000-000000000003',
  'Fictional admin-created note.'
);
insert into public.activities (lead_id, summary)
values (
  '10000000-0000-4000-8000-000000000003',
  'Fictional admin-created activity.'
);
do $$
begin
  begin
    update public.lead_notes set body = 'Attempted admin edit'
    where body = 'Fictional admin-created note.';
    raise exception 'Admin unexpectedly edited a note';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.activities
    where summary = 'Fictional admin-created activity.';
    raise exception 'Admin unexpectedly deleted an activity';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
select public.link_duplicate_leads(
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003'
);
reset role;

-- Inactive profiles lose all RLS-scoped access even if their Auth session exists.
select set_config('request.jwt.claim.sub', '', true);
update public.profiles
set is_active = false
where id = current_setting('phase3.counsellor_id')::uuid;
select set_config(
  'request.jwt.claim.sub',
  current_setting('phase3.counsellor_id'),
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.leads) <> 0 then
    raise exception 'Inactive counsellor unexpectedly retained lead access';
  end if;
  begin
    perform public.check_lead_duplicate('+919876540001', null);
    raise exception 'Inactive counsellor unexpectedly used duplicate RPC';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
update public.profiles
set is_active = true
where id = current_setting('phase3.counsellor_id')::uuid;

-- Anonymous clients have no direct lead access or duplicate RPC access.
set local role anon;
do $$
begin
  begin
    perform count(*) from public.leads;
    raise exception 'Anonymous role unexpectedly queried leads';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform * from public.check_lead_duplicate('+919876540003', null);
    raise exception 'Anonymous role unexpectedly called duplicate lookup';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

-- The whole script is transactional: remove fictional fixture changes.
--
-- CRUD access matrix encoded by the migration and verified below:
--   profiles: all authenticated roles SELECT scoped profiles; no client I/U/D.
--   courses/lead_sources: counsellor SELECT active rows; manager/admin CRUD.
--   leads: all roles SELECT/INSERT/UPDATE within RLS; no client DELETE.
--   follow_ups: all roles SELECT/INSERT/UPDATE through lead visibility; no DELETE.
--   lead_notes/activities: all roles SELECT/INSERT through lead visibility; no U/D.
--   lead_status_history: all roles SELECT through lead visibility; no I/U/D.
--   lead_assignment_history: manager/admin SELECT only; no I/U/D.
--   duplicate_links: manager/admin SELECT only; writes only through RPC.
--   duplicate-check window/log tables: no direct client S/I/U/D for any role.
-- The assertions below check each table's granted operation surface and each
-- application's RLS-specific paths. Anonymous checks include every table and
-- every function created by the migration.

create temporary table phase3_test_tables (
  table_name text primary key,
  expected_authenticated_select boolean,
  expected_authenticated_insert boolean,
  expected_authenticated_update boolean,
  expected_authenticated_delete boolean
) on commit drop;

insert into phase3_test_tables values
  ('profiles', true, false, false, false),
  ('courses', true, true, true, true),
  ('lead_sources', true, true, true, true),
  ('leads', true, true, true, false),
  ('follow_ups', true, true, true, false),
  ('lead_notes', true, true, false, false),
  ('activities', true, true, false, false),
  ('lead_status_history', true, false, false, false),
  ('lead_assignment_history', true, false, false, false),
  ('duplicate_links', true, false, false, false),
  ('lead_duplicate_check_windows', false, false, false, false),
  ('lead_duplicate_check_log', false, false, false, false);

do $$
declare
  table_check record;
  privilege_name text;
  expected boolean;
  actual boolean;
begin
  for table_check in select * from phase3_test_tables loop
    foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      expected := case privilege_name
        when 'SELECT' then table_check.expected_authenticated_select
        when 'INSERT' then table_check.expected_authenticated_insert
        when 'UPDATE' then table_check.expected_authenticated_update
        else table_check.expected_authenticated_delete
      end;

      execute pg_catalog.format(
        'select pg_catalog.has_table_privilege(''authenticated'', ''public.%I'', %L)
          or case when %L = ''DELETE'' then false
            else pg_catalog.has_any_column_privilege(''authenticated'', ''public.%I'', %L)
          end',
        table_check.table_name,
        privilege_name,
        privilege_name,
        table_check.table_name,
        privilege_name
      ) into actual;

      if actual is distinct from expected then
        raise exception 'Unexpected authenticated % grant on public.%: expected %, got %',
          privilege_name, table_check.table_name, expected, actual;
      end if;

      execute pg_catalog.format(
        'select pg_catalog.has_table_privilege(''anon'', ''public.%I'', %L)
          or case when %L = ''DELETE'' then false
            else pg_catalog.has_any_column_privilege(''anon'', ''public.%I'', %L)
          end',
        table_check.table_name,
        privilege_name,
        privilege_name,
        table_check.table_name,
        privilege_name
      ) into actual;
      if actual then
        raise exception 'Anonymous has unexpected % grant on public.%',
          privilege_name, table_check.table_name;
      end if;
    end loop;
  end loop;
end
$$;

do $$
declare
  function_name text;
  function_signature text;
begin
  for function_name, function_signature in
    select expected.function_name, expected.function_signature
    from (values
      ('current_app_role', 'public.current_app_role()'),
      ('is_active_app_user', 'public.is_active_app_user()'),
      ('is_manager_or_admin', 'public.is_manager_or_admin()'),
      ('set_updated_at', 'public.set_updated_at()'),
      ('create_profile_for_auth_user', 'public.create_profile_for_auth_user()'),
      ('normalize_lead_email_and_enrollment', 'public.normalize_lead_email_and_enrollment()'),
      ('record_lead_stage_change', 'public.record_lead_stage_change()'),
      ('record_lead_assignment_change', 'public.record_lead_assignment_change()'),
      ('protect_profile_privileges', 'public.protect_profile_privileges()'),
      ('update_follow_up_state', 'public.update_follow_up_state()'),
      ('check_lead_duplicate', 'public.check_lead_duplicate(text,text)'),
      ('assign_lead', 'public.assign_lead(uuid,uuid)'),
      ('link_duplicate_leads', 'public.link_duplicate_leads(uuid,uuid)'),
      ('set_lead_archived', 'public.set_lead_archived(uuid,boolean)')
    ) as expected(function_name, function_signature)
  loop
    if pg_catalog.has_function_privilege('anon', function_signature, 'EXECUTE') then
      raise exception 'Anonymous unexpectedly has EXECUTE on %', function_signature;
    end if;
  end loop;
end
$$;

rollback;
