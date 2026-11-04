# Rundingan Kreasi Media — Production Release Checklist

This checklist is for the first single-organization internal release. It is not authorization to modify Production.

## Current release package

- PR #13: module catalog, Report Center foundation, shared transaction spine, enterprise operations and embedded diagnostics (already merged).
- PR #15: production runtime-role compatibility, health-ledger corrections, CMS draft grants and first operational workspaces for ACADEMY, CREATIVE, EVENT, MEDIA and PRODUCTION.
- Required additive migrations: `20261103_001_custom_cms` through `20261104_010_hr_inventory_procurement_depth`, applied in ascending order after the existing core migrations 0001–0003. This includes Finance foundation (008), AR/AP/cash-bank (009), and HR/Inventory/Procurement depth (010).

## Before any Production write

1. Obtain explicit Owner approval for the Production release window.
2. Take and verify a Neon Production branch snapshot/restore point.
3. Confirm the Production deployment uses the Production Neon branch and the restricted login role `rundingan_runtime_web`.
4. Confirm the role bootstrap in migration 003 creates or reuses `rundingan_app_limited` and grants it to `rundingan_runtime_web`.
5. Apply migrations 001–010 in order using the database owner role. Do not skip a migration or manually mark it applied.
6. Verify all required tables and migration markers using `/api/health`. Do not continue if it returns anything other than HTTP 200 with schema complete.
7. Verify CMS draft SELECT/INSERT/UPDATE and module-work-item SELECT/INSERT/UPDATE as the runtime login.
8. Verify that no temporary release-test records remain.

## Application acceptance

Use an authorized Owner account in a real browser session:
- Sign in and confirm session persistence/sign-out.
- Open Enterprise, Access Control, Organization Structure, Governance and Module Catalog.
- Create one disposable draft work item in each of ACADEMY, CREATIVE, EVENT, MEDIA and PRODUCTION; verify list, status transition, audit event, transaction link and print output; then remove only the explicitly created test fixtures using an approved cleanup path.
- Open Report Center and verify date filters, module filter, permission-gated sections and Print / Save as PDF.
- Create a CMS draft and verify it can be saved and edited. Do not publish a public article as a smoke test.
- Verify Finance journal drafts are balanced; do not post test journals. Verify AR/AP document drafts, settlement allocations and bank statement import/reconciliation drafts without posting or reconciling live balances.
- Verify HR employee/payroll drafts with synthetic records only; do not approve or disburse payroll.
- Verify inventory and procurement using synthetic item, PO and Goods Receipt fixtures only. Confirm tenant-scoped foreign keys, PO-to-AP document linkage and receipt line quantities; do not post stock or alter real stock balances.
- Verify agents can read diagnostics and persist audit/report records; do not authorize any agent to perform business mutations.

## Scheduled agents

- Production currently has no `CRON_SECRET` environment variable.
- Generate a high-entropy secret with a password manager or secure secret generator and add it to the Production environment only after Owner approval.
- Redeploy Production after the secret is configured, then manually call the cron route with the matching Bearer token and confirm successful agent runs.
- Vercel Cron runs on Production deployments. Do not claim scheduled monitoring is active until this test succeeds.

## Explicit scope limits

- This is a single-organization internal release. CMS and multiple API routes still use the fixed organization slug; do not onboard other companies or market this as SaaS multi-tenant until authenticated organization context, CMS organization_id, tenant-scoped queries and tenant isolation tests are completed.
- The five core module workspaces provide a first shared work-item workflow, not complete LMS, creative asset management, event ticketing, media distribution or production scheduling suites.
- Work-item budget values are planning estimates, not posted accounting.
- Full P&L, balance sheet, trial balance, general ledger, tax and bank reconciliation are not included.
- Payroll does not calculate PPh 21, BPJS, THR or statutory benefits automatically.
- Rental remains an optional entitlement; its full operational workflow is not included.
- The public Vercel subdomain is the current canonical URL. A custom production domain and DNS cutover require a separately confirmed domain.

## Stop / rollback rules

- If a migration fails, stop immediately; do not continue with later migrations or manually edit the schema to bypass the failure.
- Do not drop tables or reverse additive migrations in Production.
- If application code fails after deployment, use Vercel rollback to the last known-good deployment while keeping database changes intact; investigate with a forward-fix migration if needed.
- Preserve audit logs and financial records. Never use test data cleanup queries against Production without verifying exact IDs and Owner approval.
