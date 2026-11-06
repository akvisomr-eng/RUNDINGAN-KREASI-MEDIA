# Six Specialist Application Blueprints

Each specialist application is independently owned, versioned, deployed, and operated. These specifications define its business boundary and data ownership before repository scaffolding.

## Shared capabilities inherited from Enterprise Core

- Identity, organization membership, business units, and access claims.
- Canonical customer, supplier, and employee references.
- Central chart of accounts, accounting periods, journal posting, and consolidated reporting.
- Subscription entitlement, audit governance, and integration registry.
- Shared file identity/rights metadata standards where applicable.

## Specialist responsibilities

| App | Operational source of truth | Finance boundary |
|---|---|---|
| MEDIA | Editorial, newsroom, publishing, advertising operations | Campaign/advertising billing requests and operational revenue detail |
| ACADEMY | Courses, cohorts, enrollment, attendance, assessment, certificates | Tuition, registration, and course fee billing requests |
| RENTAL | Assets, availability, reservations, contracts, handover, maintenance | Rental charges, deposits, damage fees, and settlement requests |
| PRODUCTION | Production projects, crew, schedules, production assets, deliverables | Project estimates, cost tracking, change orders, and billing requests |
| CREATIVE | Creative briefs, design projects, assets, revisions, approvals | Creative service estimates, milestone billing, licensing charges |
| EVENT | Event plans, venues, tickets, attendees, vendors, run-of-show | Ticketing settlement, sponsorship, vendor cost, and event billing detail |

## Non-duplication rules

1. Shared people, organizations, customers, suppliers, and employee identities are referenced by Core IDs.
2. Each app stores only its own operational records and app-specific CRM activity.
3. Employee contracts, central payroll, and group HR policy remain in Core. Apps may schedule or assign people for their workflows.
4. General Ledger, chart of accounts, and accounting periods remain in Core. Apps maintain operational subledgers and submit approved posting requests.
5. Each app's operational reports remain local; group-wide consolidation is produced by Core.
6. Each app must define data retention, file rights, audit events, and export behavior.

## Required app-level modules

Every app must include its own:
- workspace and role-aware navigation;
- operational dashboard and reporting;
- customer/supplier interaction history scoped to the app;
- approval workflow and activity log;
- operational budget and billing request workflow;
- settings, notification preferences, and integration health;
- import/export and audit trail;
- application-specific AI assistant only after data access and safety policies are approved.

## Delivery order

RUNDINGAN MEDIA is the first pilot. ACADEMY and RENTAL follow after the pilot's authentication, database isolation, API, and finance posting patterns pass acceptance. PRODUCTION, CREATIVE, and EVENT follow using the same integration standards.
