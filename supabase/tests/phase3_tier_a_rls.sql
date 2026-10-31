-- Manual SQL Editor test for a disposable development project only.
-- First create three users in Supabase Dashboard > Authentication:
--   phase3-admin@example.test
--   phase3-manager@example.test
--   phase3-counsellor@example.test
-- The auth trigger in the migration creates their counsellor profiles.
-- Replace these three example addresses below with the addresses you created.
-- This script does not create Auth users. It temporarily assigns fixture roles
-- and creates clearly fictional data, then rolls all test data back.
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
update public.profiles as p
set role = u.test_role,
    display_name = case u.test_role
      when 'admin' then 'Fictional Test Admin'
      when 'manager' then 'Fictional Test Manager'
      else 'Fictional Test Counsellor'
    end
from phase3_test_user_ids as u
where p.id = u.user_id;

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

-- Manager and admin must each see all three leads.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'manager'),
  true
);
set local role authenticated;
do $$
begin
  if (select count(*) from public.leads) <> 3 then
    raise exception 'Manager must see every lead in the single branch';
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
  if (select count(*) from public.leads) <> 3 then
    raise exception 'Admin must see every lead in the single branch';
  end if;
end
$$;
reset role;

-- Counsellor sees exactly the created and assigned leads, never the manager-only row.
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

  if exists (
    select 1
    from public.leads
    where id = '10000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Counsellor must not see an unrelated archived lead';
  end if;

  update public.follow_ups
  set due_at = due_at + interval '1 day'
  where id = '20000000-0000-4000-8000-000000000001';

  if (select reschedule_count from public.follow_ups
      where id = '20000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Changing follow-up due time must increment reschedule_count';
  end if;

  begin
    perform public.assign_lead(
      '10000000-0000-4000-8000-000000000001',
      auth.uid()
    );
    raise exception 'Counsellor unexpectedly assigned a lead';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

-- Protected lead columns must be rejected by SQL privileges.
do $$
begin
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

  for check_number in 1..20 loop
    select * into duplicate_result
    from public.check_lead_duplicate('+919876540003', 'ARCHIVED@EXAMPLE.TEST');
  end loop;

  if duplicate_result.rate_limited is distinct from true
    or duplicate_result.has_match is not null then
    raise exception 'Duplicate lookup must return an explicit rate-limited result';
  end if;
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
    or duplicate_result.rate_limited is distinct from false then
    raise exception 'Manager duplicate response must include matching owner identity';
  end if;
end
$$;

-- Assignment RPC is manager-only, and its update must create a history row.
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
reset role;

-- Admin must also be authorized to link duplicates.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from phase3_test_user_ids where test_role = 'admin'),
  true
);
set local role authenticated;
select public.link_duplicate_leads(
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003'
);
reset role;

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
rollback;
