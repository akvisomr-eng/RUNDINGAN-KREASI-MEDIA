# Rundingan Kreasi Media — Supabase Release Checklist

This checklist is for the first single-organization internal release. It is not authorization to modify a Production database.

## Current release package

- The app has been switched in code from Neon PostgreSQL/Neon Auth to Supabase PostgreSQL/Supabase Auth.
- Production project `sgvyyawjjkdvemobtumz` (`RUNDINGAN-KREASI-MEDIA`, `ap-southeast-1`) remains unchanged. Development project `qlwnyvwmnzvcvfodhzic` (`RUNDINGAN-KREASI-MEDIA-DEV`, `ap-southeast-1`) is the authorized migration target and was healthy when checked.
- Schema migrations core `database/migrations/0001`–`0003` and `db/migrations/20261103_001`–`20261123_015` are applied to Development in order. Migration history contains 18 entries. All 77 public tables have RLS enabled, `anon`/`authenticated` have no table privilege, and organization-owned rows (including CMS posts/audits) are scoped by RLS to the configured `rundingan-kreasi-media` organization. Shared lookup tables are available only to the limited server role. The Rental, Production, and Academy tables and their overlap/capacity triggers are present. No Rental equipment, Production projects, or Academy courses were seeded.
- `rundingan_app_limited` has only explicit SELECT/INSERT/UPDATE grants and is a NOLOGIN privilege group; `rundingan_runtime_web` has not yet been provisioned. `lib/db.ts` now rejects database URLs that do not use that dedicated runtime login, preventing accidental use of the `postgres` owner. The RLS policy secures the current single-organization deployment; per-user module/role authorization remains enforced in server routes. The Supabase connector runs as `postgres` and rejects `SET ROLE`, so an actual runtime-login test remains outstanding. Keep the `service_role` key secret because it bypasses RLS.
- Future-object default ACL hardening applies to objects created as `postgres` (the connected migration executor). Supabase-managed `supabase_admin` defaults could not be changed with the available privileges; if DDL is run under another owner, explicitly revoke API-role grants and enable RLS before exposing the objects.
- Neon data and Auth users have not been copied to Supabase. The former Neon project remains untouched. Application/browser acceptance testing, runtime credential/grant verification, and Auth deployment configuration remain outstanding.

## Remaining pre-release work

1. Keep all schema changes on Development until an explicitly approved Production release window and verified backup/restore point exist. Do not modify Production or the old Neon service as part of this work.
2. Configure a restricted runtime database login and verify its grants. Do not use Supabase project-owner credentials as the deployed runtime URL.
3. Set `DATABASE_URL` to the Supabase transaction-pooler connection string, plus `NEXT_PUBLIC_SUPABASE_URL` and the project publishable/anon key in secret stores. Never commit credentials or expose the database URL to client bundles.
4. Development Auth is currently configured with Site URL `http://localhost:3000`, email signup enabled, confirmation required, and only `http://localhost:3000/auth/callback` in its redirect allow-list. This supports local callback testing only. Configure the actual Development preview/deployment URL and SMTP before end-to-end email testing. Configure Production SMTP/origins only during the approved release process.
5. Schema migrations 0001–0003 and 001–015 are already applied to Development. For any future migrations, apply in ascending order using the `postgres` migration executor and verify the resulting migration history/schema before proceeding.
6. Provision the dedicated runtime login as a member of `rundingan_app_limited`, configure its pooler URL in the application secret store, then verify SELECT/INSERT/UPDATE behavior, RLS tenant filtering, `auth.users` directory lookup and `/api/health` from the deployed app. Do not use the `postgres` owner or Supabase `service_role` for the web runtime.
7. Confirm no temporary migration fixtures remain.

## Application acceptance

Use synthetic records and a test Supabase Auth account in a browser:
- Verify sign-up, email confirmation, sign-in, password recovery/update, sign-out and session restoration.
- Public pages stay public; workspace redirects without a session; private APIs return 401/403 as appropriate.
- Confirm signup does not grant roles. Assign a synthetic user role, verify organization/unit scopes, revoke it and inspect audit events.
- Open Enterprise, Access Control, Organization Structure, Governance, Module Catalog, Rental, Production and Academy/LMS.
- Test Rental availability, Production equipment calendar conflicts, Academy enrollment capacity, status transitions and audit events with synthetic fixtures only.
- Open Report Center and verify permission-gated sections and Print/CSV output.
- Create CMS drafts only; do not publish as a smoke test.
- Verify Finance journal drafts are balanced; do not post test journals. Verify AR/AP and bank statement drafts without posting or reconciling live balances.
- Verify HR and payroll with synthetic data only; do not approve or disburse payroll.
- Verify inventory/procurement with synthetic item, PO and Goods Receipt fixtures only; do not post stock or alter real balances.
- Never use real customer bookings, payouts, payroll, stock movements, public publishing, or production records as smoke tests.

## Legacy Neon transition

- Do not delete, pause, migrate, or write to the former Neon project as part of this code change.
- Neon Auth users and password credentials cannot be copied as ordinary application rows. Plan account invitations or a supported identity migration separately; map users to existing/new application roles only after Owner review.
- Reconcile any Neon-only business records through a separately approved export/import plan. Development now has the migrated application schema and baseline organization/authorization records, but Neon business records and Auth users have not been imported.
