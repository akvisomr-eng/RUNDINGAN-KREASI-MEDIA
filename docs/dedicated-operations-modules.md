# Dedicated Rental, Production, and Academy/LMS modules

Implementation baseline for the missing operational domains called out by the Rundingan Kreasi Media master plan. This work adds dedicated, organization-scoped tables and workspaces while retaining the existing shared `business_transactions` spine. It is additive; existing module work items and business data are not rewritten.

## Deployment status and migration order

Migration `db/migrations/20261123_011_rental_production_academy.sql` follows `20261104_010_hr_inventory_procurement_depth.sql`. Apply the full existing sequence on the confirmed Supabase development target only after the release checklist's read-only preflight. **This migration has not been applied to Supabase in this coding task.** No Supabase database writes or migration application were attempted. Do not run against Production without explicit Owner approval and a Supabase backup/restore point.

The migration creates the rental inventory/bookings/checkout/maintenance/incident tables, production project/crew/equipment/delivery/revision/cost tables, and academy course/lesson/instructor/class/student/enrollment/attendance/assessment/result/certificate tables. It seeds only permissions and enables the already-catalogued Rental module for the organization; it does not seed operational fixtures. RLS remains disabled, consistent with the current application model; every server route checks the signed-in user and module permission and scopes every query to `rundingan-kreasi-media`.

## Workspaces and routes

- `/workspace/enterprise/rental` — equipment-unit registry, draft/requested/confirmed bookings, deposit amount, check-out/check-in, conditions, maintenance, and incident records.
- `/workspace/enterprise/production` — project brief and status pipeline, customer, assigned crew, Rental equipment allocations, deliverables/revisions, and pending cost entries.
- `/workspace/enterprise/academy` — course publishing, lesson records, instructors, scheduled classes, students, capacity-limited enrollment, attendance, assessments/grades, and completion certificates.
- `GET/POST /api/enterprise/rental`, `/api/enterprise/production`, `/api/enterprise/academy` — session-authenticated and permission-gated server APIs. Responses contain business data only for the fixed organization slug.

Dedicated permission codes: `rental.read/manage`, `production.read/manage`, and `academy.lms.read/manage`. Owner, administrator, and unit manager receive read/manage; staff and viewer receive read only, following current role-seeding conventions. Existing generic work-item permissions are retained for compatibility.

## Integrity and safety rules

- Rental and production equipment are individual physical units, not aggregate quantities. PostgreSQL trigger guards use transaction-scoped advisory locks and inclusive date ranges to reject overlapping booking or production allocations, including competing requests. Both paths check the shared Rental/Production calendar.
- Booking confirmation and Production approval enforce a basic maker-checker rule: the record creator cannot confirm/approve their own record. Approval/release actions are not exposed for payroll, journal posting, inventory movements, or payments.
- Academy enrollment capacity is checked in the API and protected by a database trigger. Grades are rejected when outside the assessment's maximum score; certificates require a completed class and completed enrollment.
- User-driven writes are recorded in `audit_logs`; rental bookings and production projects also create draft `business_transactions` linked to their source records. They do not post journals, collect payments, or move stock.
- Runtime database grants are limited to SELECT/INSERT/UPDATE; no DELETE or DDL grants are added. No RLS policy is introduced before the auth model is ready.

## Current intentional boundaries

This is an operational baseline, not a claim that all master-plan production requirements are complete. Payment collection/refunds, rental contract/document generation, customer self-service, legal-grade deposit reconciliation, approval-limit configuration, automatic finance journals, inventory valuation, payroll/tax statutory compliance, storage uploads, notifications, and production vendor/subcontractor purchasing remain follow-up work. Production expenses remain pending and do not affect the General Ledger. Certificates are issued as records only; signed PDF generation is not yet connected. The existing finance, procurement, HR, and reporting services remain separate foundations.

## Verification checklist

- `npm run typecheck`
- `npm run build` with only local placeholder Supabase Auth environment values; do not use live DB credentials during build verification.
- The full migration sequence was executed in an ephemeral local PGlite/PostgreSQL-compatible database, including migration 011. Synthetic fixtures confirmed overlapping Rental bookings are rejected, Production allocations conflict with Rental reservations, and Academy class capacity is enforced. This is not a Supabase migration or live-target verification.
- After a separately approved development migration: run `/api/health`, then synthetic-only concurrent availability race, permission-denial, and audit checks. Never use real customer bookings, payroll, journal posting, stock movements, payments, or article publication as smoke tests.
