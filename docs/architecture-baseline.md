# Architecture baseline

## Operating model
- One legal/business organization with six operating business units.
- Shared master data and shared enterprise services; no duplicated module databases.
- Initial deployment is single-organization. The schema is organization-scoped so a future SaaS tenant boundary can be introduced without treating external tenants as active today.
- Modular monolith, API-first. Web, future Android, and desktop clients use the same server-side domain services and PostgreSQL source of truth.

## Core boundaries
- Core: organizations, business units, departments, locations, users, roles, permissions, audit.
- Shared business services: CRM, finance, HR, inventory/assets, procurement, reporting.
- Business modules: Media/CMS, Academy/LMS, Rental operations, Production projects, Creative services, Event operations.
- Integrations: payment, messaging, storage, AI providers, analytics.

## Data rules
- Every business record must be organization-scoped; records owned by a business unit also carry business_unit_id.
- Shared customer, supplier, employee, chart-of-account, and asset masters are not duplicated per module.
- Use UUID primary keys, timestamptz audit fields, soft-delete only where business retention requires it, and explicit status transitions.
- Do not enable row-level security until the authentication identity and authorization model are implemented and tested. Server-side authorization remains mandatory.
- Production database is not a target for initial migrations. Develop and validate against the Neon development branch first.

## Client strategy
- Web: Next.js application on Vercel.
- Mobile: later Android client using the same authenticated API.
- Desktop/offline: later Windows client with local SQLite, durable sync queue, conflict handling, and explicit sync status. Cloud AI, collaboration, and remote backup require connectivity.
