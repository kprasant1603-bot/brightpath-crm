-- Optional, clearly fictional seed example for the development SQL Editor only.
-- Not executed by the application or during Phase 5 implementation.
-- Confirm these three test profiles and their roles exist before running.
-- The SQL Editor owner context may insert explicit created_by values for fixtures.

with expected_creators as (
  select
    p.id,
    p.role
  from public.profiles as p
  join auth.users as u on u.id = p.id
  where lower(u.email) in (
    'phase3-admin@example.test',
    'phase3-manager@example.test',
    'phase3-counsellor@example.test'
  )
),
fictional_leads (full_name, phone_e164, email, creator_role) as (
  values
    ('Fictional Admin Seed Lead', '+919876540101', 'admin-seed@example.test', 'admin'),
    ('Fictional Manager Seed Lead', '+919876540102', 'manager-seed@example.test', 'manager'),
    ('Fictional Counsellor Seed Lead', '+919876540103', 'counsellor-seed@example.test', 'counsellor')
)
insert into public.leads (full_name, phone_e164, email, created_by)
select
  fictional.full_name,
  fictional.phone_e164,
  fictional.email,
  creator.id
from fictional_leads as fictional
join expected_creators as creator
  on creator.role = fictional.creator_role
returning id, full_name, created_by, stage_code;
