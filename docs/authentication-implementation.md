# Authentication and access control — Supabase

## Current target state
- The app uses Supabase Auth and Supabase PostgreSQL. The active development target is `qlwnyvwmnzvcvfodhzic` (`RUNDINGAN-KREASI-MEDIA-DEV`, `ap-southeast-1`). Production project `sgvyyawjjkdvemobtumz` remains unchanged.
- Development has the core schema and application migrations `0001`–`015` applied (18 migration records total). All 77 public tables have RLS enabled. `anon` and `authenticated` have no direct table grants; organization-owned rows, including CMS posts/audits, are restricted to `rundingan-kreasi-media` for this single-organization release.
- The development DB/Auth/REST/Storage services are healthy. Auth email/signup is enabled, email confirmation is required, the Site URL is `http://localhost:3000`, and the allow-list contains only `http://localhost:3000/auth/callback`. SMTP and the eventual deployment origin are not configured.
- No Neon accounts, password hashes, or business records have been migrated. Signup does not grant an application role.

## Application integration
- `@supabase/ssr` provides browser/server Auth clients. `proxy.ts` refreshes sessions and protects `/workspace/*`; private API handlers independently validate the session and permission.
- Server-side SQL uses `postgres` over Supabase's transaction pooler with prepared statements disabled for PgBouncer compatibility. `lib/db.ts` requires the `rundingan_runtime_web` database login; owner (`postgres`) and `service_role` URLs are rejected because they bypass the runtime RLS boundary.
- `rundingan_runtime_web` must be provisioned as a login member of `rundingan_app_limited`. That login and the application's `DATABASE_URL` secret are not yet provisioned/configured, so no authenticated runtime DB smoke test has been completed.
- RLS policies scope organization-owned tables to the fixed slug `rundingan-kreasi-media`; three shared lookup/metadata tables remain available to the limited server role. Per-user module authorization remains in the server. This is a single-organization boundary, not a multi-tenant SaaS context model; onboarding another organization requires request-scoped tenant context and a revised RLS design.
- `service_role` bypasses RLS and must remain server-secret. The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key.
- The restricted administrative directory lookup uses Supabase Auth's `auth.users`; no passwords or auth secrets are copied to app tables. Social OAuth is not configured.

## Remaining gates before live use
1. Provision a dedicated `rundingan_runtime_web` login as a member of `rundingan_app_limited`; store its transaction-pooler URL only in the hosting secret manager. Verify effective SELECT/INSERT/UPDATE grants and organization RLS filtering from that login.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key in hosting secrets. Never expose `DATABASE_URL` to browser code.
3. Select/confirm the hosting project and deployment origin. Add exact preview/production callback URLs and configure SMTP before testing confirmation and password-recovery delivery.
4. Keep schema changes on Development until a Production release window and verified backup/restore point are approved. Apply migrations to Production only through that release gate; Development migrations do not authorize Production writes.
5. Run `/api/health` and browser acceptance against Development: signup/confirmation, sign-in/out, password recovery, session refresh, protected-route denials, role assignment/revocation, tenant scoping, and Rental/Production/Academy synthetic workflows.
6. Plan Neon account/data reconciliation separately. Do not delete/disable Neon or migrate users/business records without an approved identity/data migration plan.
