# Bootstrap the first BrightPath CRM admin

Run this only in the Supabase project's SQL Editor as the database owner, after
the Phase 3 migration has been reviewed and applied. Do not run it as an
authenticated application user.

1. In Supabase Authentication, create the intended owner's user and complete
   any required email confirmation.
2. Replace the email literal below with that exact account email.
3. Before executing the update, verify that `auth.uid()` is `NULL`. In the
   SQL Editor, the database-owner session should have no end-user JWT identity.
   The profile protection trigger intentionally rejects role changes when an
   end-user identity is present.
4. Run this SQL as one transaction:

```sql
begin;

do $bootstrap$
declare
  target_user_id uuid;
begin
  if auth.uid() is not null then
    raise exception
      'Run bootstrap as the database owner in SQL Editor, not as an app user';
  end if;

  select u.id
  into target_user_id
  from auth.users as u
  where lower(u.email) = lower(btrim('owner@example.com'));

  if target_user_id is null then
    raise exception
      'No Auth user found; create and confirm the owner account first';
  end if;

  update public.profiles
  set role = 'admin',
      is_active = true
  where id = target_user_id;

  if not found then
    raise exception
      'Profile not found; verify the profile-creation Auth trigger ran';
  end if;
end
$bootstrap$;

commit;
```

The migration creates a `counsellor` profile for each new Auth user. The
`profiles_protect_privileges` trigger blocks a role or `is_active` change when
`auth.uid()` is non-NULL, and authenticated clients have no UPDATE grant on
profiles. The SQL Editor owner has no end-user JWT identity, so the guarded
owner update above is allowed by that trigger. The owner should verify the
profile's role in the dashboard or by a read-only SQL query after the
transaction.

This is a one-time bootstrap instruction, not a client-facing role-management
flow. Later role changes and deactivation require a separately reviewed,
server-side administrative path. Never expose a database-owner credential or
service-role key in the browser.
