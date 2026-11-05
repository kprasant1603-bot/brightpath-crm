# Supabase Auth setup and manual checks

Phase 4 uses the development Supabase project and public browser configuration only. Configure local values in `.env` using the two names shown in `.env.example`; do not share their values. Restart Vite after changing local configuration. If either value is missing or invalid, the app displays a setup message and does not display CRM data.

## Development Auth settings

In the Supabase Dashboard for `brightpath-crm-dev`:

1. In Authentication settings, review the Email provider's confirmation requirement and password policy. The `.example.test` addresses cannot receive mail; if confirmation is required, confirm these test users through the dashboard.
2. In URL Configuration, set the local development Site URL to `http://localhost:5173`. Add that local origin to the redirect allow list. When an authorized preview exists, add its exact origin there as well.
3. Use only the development project for local and preview testing. Production is a separate, uncreated project.
4. Ensure the three test users exist and have profile rows created by the database's Auth trigger. Set or reset each password privately in the dashboard. Do not send passwords in chat or place them in source, environment templates, URLs, or test fixtures.

This phase has sign-in and sign-out only. It has no sign-up, password recovery, or invite UI. Credentials are submitted directly to Supabase Auth and are never placed in the browser URL. Supabase Auth persists the session in the browser's default storage and refreshes it automatically. Signing out clears the session.

## Role-by-role sign-in verification

Use a private browser window, or sign out fully between each account. Keep passwords private and enter them directly into the sign-in form.

1. Open `http://localhost:5173/sign-in`.
2. Sign in as `phase3-admin@example.test`. Confirm the signed-in workspace shows role `admin`, refresh the page, and confirm the session and role are restored without signing in again. Then sign out and confirm the sign-in screen returns.
3. Repeat with `phase3-manager@example.test`; verify the displayed role is `manager` before and after refresh, then sign out.
4. Repeat with `phase3-counsellor@example.test`; verify the displayed role is `counsellor` before and after refresh, then sign out.
5. Try an incorrect password for one account. The only authentication message should be: “Sign-in failed. Check your email and password.” It must not reveal whether the account exists.
6. Confirm no sign-up or password-recovery actions are present. Do not treat the displayed role as authorization; database RLS is authoritative.

Report local and deployed-preview results separately. Preview sign-in is **NOT RUN** until a preview is authorized and available.
