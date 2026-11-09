# Data Ownership and Database Boundaries

## Database topology

| Database | Owning application | Authoritative data |
|---|---|---|
| Enterprise Core | RUNDINGAN Enterprise Core | Identity references, organizations, business units, shared masters, central finance, central HRM, audit and integration registry |
| db_media | RUNDINGAN MEDIA | Editorial and media operations |
| db_academy | RUNDINGAN ACADEMY | Learning and academic operations |
| db_rental | RUNDINGAN RENTAL | Rental assets, reservations, contracts and maintenance |
| db_production | RUNDINGAN PRODUCTION | Production projects, crew, schedules, assets and production costs |
| db_creative | RUNDINGAN CREATIVE | Creative briefs, projects, reviews, deliverables and digital assets |
| db_event | RUNDINGAN EVENT | Event operations, tickets, attendees, venues and run-of-show |

The six specialist databases are separate PostgreSQL databases, not merely schemas in one shared database. They may initially share one Neon project and compute. Enterprise Core remains in its own Neon project.

## Ownership matrix

| Entity | System of record | Specialist behavior |
|---|---|---|
| User identity | Enterprise identity provider | Store external subject ID; do not create a separate password store |
| Organization | Enterprise Core | Reference by immutable organization ID |
| Business unit | Enterprise Core | Reference by immutable business-unit ID |
| Customer / supplier identity | Enterprise Core | Reference by party ID; keep only app-specific relationship metadata locally |
| Employee identity | Enterprise Core | Reference employee ID; store app-specific assignment/availability only where required |
| Chart of accounts | Enterprise Core | Reference account ID; never create an app-specific duplicate GL |
| Accounting period | Enterprise Core | Request validation before posting |
| Journal and ledger | Enterprise Core | Store returned journal ID and posting status |
| Specialist operational record | Owning specialist app | Full write ownership stays in that app |
| Specialist files | Owning app/object storage policy | Store file metadata and rights/access state with the owning app |

## Reference data projections

An app may keep a local projection to avoid a synchronous network call for every page view. A projection must include:
- `source_system`
- `source_record_id`
- `source_version` or `source_updated_at`
- `synced_at`
- `is_active` / `deleted_at`

Projection tables must be read-only to ordinary application workflows. Updates arrive only from authenticated integration events or controlled reconciliation jobs.

## Transaction and finance boundary

Specialist apps own operational documents and their approval workflow. Enterprise Core owns the canonical accounting journal.

A financial posting request must contain:
- organization and business-unit IDs;
- source application and source record ID;
- document/reference number and effective date;
- currency and exchange rate where applicable;
- balanced debit/credit lines with account references;
- tax, cost center, project and party references when applicable;
- approver identity and approval evidence;
- idempotency key and payload schema version.

Enterprise Core validates the request, accounting period, account status, organization scope, approval state, and balance. It returns a durable posting result and journal reference. A repeated request with the same idempotency key must return the original result, not create another journal.

## Cross-system consistency

- Prefer asynchronous events for non-critical projections.
- Use synchronous API commands for actions that require an immediate authoritative decision, such as journal posting or entitlement checks.
- Use the outbox pattern in the source database and an inbox/deduplication record in the consumer.
- Include event ID, event type, schema version, source system, organization ID, aggregate ID, occurred-at timestamp, and correlation ID.
- Support replay and dead-letter review without silently dropping events.

## Data lifecycle

Each application must document retention, archival, deletion, legal hold, export, and restore behavior for its own data. Deleting an organization or shared master must be a governed workflow with dependency checks, not a cascade across unrelated databases.
