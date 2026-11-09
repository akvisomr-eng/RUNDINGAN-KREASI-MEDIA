# RUNDINGAN RENTAL — Application Blueprint

## Mission
Operate rental services for equipment, vehicles, facilities, production gear, and other rentable assets.

## Owned data
- rentable asset catalogue, serial numbers, condition, and asset availability;
- reservation calendars, quotes, rental agreements, deposits;
- asset check-out/check-in, handover, inspections, damage reports;
- maintenance, downtime, repair orders, and utilization;
- rental pricing, packages, discounts, and contract-specific terms;
- delivery/pickup scheduling and operational CRM activity;
- rental charges, deposits, penalties, and billing requests.

Asset accounting and depreciation policy belong to Core finance/accounting. Rental owns operational availability and condition. Employee identity/payroll remains in Core; Rental owns staff dispatch and handover assignments.

## Module map
1. Rental catalogue and asset register
2. Availability and calendar
3. Quote and reservation management
4. Contract and e-signature workflow
5. Deposit and payment status tracking
6. Check-out / check-in and inspections
7. Delivery, pickup, and dispatch
8. Maintenance and asset downtime
9. Damage, loss, and claims
10. Customer service and rental CRM
11. Billing requests and operational finance
12. Utilization and profitability analytics

## Main workflows
Inquiry -> availability check -> quote -> reservation -> contract approval -> deposit request -> handover inspection -> active rental -> return inspection -> damage/late fee review -> billing/settlement request -> asset release.

## Database table families
`rental_assets`, `asset_categories`, `asset_conditions`, `availability_blocks`, `rental_quotes`, `reservations`, `rental_contracts`, `contract_lines`, `handover_records`, `return_inspections`, `maintenance_orders`, `damage_reports`, `dispatch_jobs`, `billing_requests`, `integration_outbox`, `integration_inbox`, `app_audit_events`.

## Integration
Consume Core parties, organization/business units, entitlement, and finance posting status. Submit approved deposits, rental invoices, penalties, and vendor cost postings to Core using idempotency keys. Store Core references only.

## Acceptance
Double-booking is prevented transactionally; asset state is auditable; unavailable assets cannot be reserved; deposits and penalties reconcile; each rental contract has immutable revision history.
