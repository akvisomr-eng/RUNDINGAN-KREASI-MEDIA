# Rundingan Kreasi Media — Unified Modules, Reports & Agents

## Module catalog

The organization module registry contains:
- ACADEMY — Rundingan Academy (active)
- CREATIVE — Rundingan Creative (active)
- EVENT — Rundingan Event (active)
- MEDIA — Rundingan Media (active)
- PRODUCTION — Rundingan Production (active)
- RENTAL — Rundingan Rental (optional plugin; inactive until installed)

The internal ENTERPRISE namespace is used only for shared ERP transactions and is hidden from the customer plugin catalog. Module installation is organization-scoped. The current plugin installer only toggles the Rental entitlement; it does not imply that the Rental operational feature set has been delivered.

## Shared data architecture

All modules use the same organization, Neon Postgres database, authentication, role assignments, permissions and audit log. The `business_transactions` table is the shared transaction spine. Finance journals, procurement requests, payroll runs and inventory movements can reference the same transaction identity. This avoids independent module databases and gives reports a common traceable reference.

A transaction spine record is not itself a journal entry. Financial recognition still requires approved account mappings and balanced debit/credit journal lines. Inventory receipt, payroll payment, and supplier payment must not be inferred from a status label alone.

## Core module operational workspaces

The first operational layer for ACADEMY, CREATIVE, EVENT, MEDIA and PRODUCTION uses the organization-scoped `module_work_items` table. Each record has a module-specific category and metadata, owner, dates, budget, controlled status transitions, audit event and linked `business_transactions` record. The workspace forms expose module-relevant fields:
- Academy: instructor, delivery mode, capacity and learning hours
- Creative: client, deliverable type and revision rounds
- Event: event type, venue and expected attendees
- Media: content format, distribution channel, editorial stage and rights status
- Production: production type, shoot location, crew lead and delivery format

The first release intentionally provides a shared work-item workflow rather than claiming complete LMS, DAM, event ticketing, editorial publishing or production scheduling suites. Module records are available in the printable Report Center and the shared transaction spine so specialist agents can monitor them. The `budget_amount` field is a planning estimate only and is excluded from posted accounting balances until a reviewed finance workflow creates a balanced journal. No payment, publication, stock movement or irreversible business action is performed by these workspaces.

## Reports

The Report Center reads actual records from the same database. It includes finance journals, employee directory, payroll, stock, procurement, CRM, CMS, audit history, module status and shared transactions. Date filters are applied where the source data supports them. The print stylesheet is designed for browser Print / Save as PDF.

## Embedded domain agents

The current agent runtime is a deterministic local expert system embedded in the application server. It does not send business records to a third-party LLM. It provides rule-based diagnostics for:
- Finance journal integrity and stale drafts
- HR data completeness and payroll workflow status
- Inventory stock thresholds and aged procurement
- CRM contact completeness
- CMS draft age and SEO metadata
- ACADEMY, CREATIVE, EVENT, MEDIA and PRODUCTION transaction monitoring; RENTAL monitoring becomes available only after its optional plugin is installed
- Application database/schema health

The embedded rules are always available without an external API. An optional Ollama adapter can add generative analysis when LOCAL_LLM_BASE_URL points to a private/local Ollama host and LOCAL_LLM_MODEL is configured (example: qwen2.5:1.5b). The adapter rejects public hosts and only sends diagnostic findings, not raw customer records. For truly local inference on a customer's PC, the application server and Ollama must run on that PC or the same private network. A Vercel deployment's localhost refers to the Vercel runtime, not the end user's computer; therefore Preview/Production remain on embedded rules unless a private local inference host is deliberately configured and reachable.

## Autonomy and safety boundaries

Agents may automatically read, analyze, create diagnostic reports and write audit records. They do not automatically:
- Pay invoices or payroll
- Post journals or close accounting periods
- Publish editorial content
- Change stock quantities or place purchase orders
- Delete business data
- Change database schema, credentials, permissions or production deployments
- Rewrite source code or deploy a repair

Those actions require explicit human approval and a reviewed execution workflow. The daily Vercel Cron route runs the Finance, HR/Payroll, Inventory/Procurement, CRM, CMS/SEO, Application Care and Enterprise Orchestrator agents. It stores each diagnostic result and audit event in the shared database. The schedule is read-only and requires a `CRON_SECRET` environment variable; it will not run successfully until that secret is configured in the Production deployment environment.

## Migration and release sequence

Apply migrations in ascending order on a fresh database:
1. Existing core migrations `0001`, `0002`, `0003`
2. `20261103_001_custom_cms`
3. `20261103_002_cms_permissions`
4. `20261104_003_enterprise_operational_modules`
5. `20261104_004_unified_modules_agents_reports`
6. `20261104_005_enterprise_transaction_module`
7. `20261104_006_limited_role_health_read_permissions`
8. `20261104_007_module_operational_workspaces`

Development has been updated and verified separately. Production migration is a separate release operation and must be approved and backed up before execution.


## Pre-live release gates

Before enabling the Enterprise workspaces on Production, complete the following in a controlled release window:

1. Take and verify a Neon Production restore point.
2. Confirm the Production application login inherits `rundingan_app_limited` and has the exact grants from migrations 003 and 006.
3. Apply migrations `20261103_001` through `20261104_007` in ascending order. Never skip a migration marker or run the sequence against a different branch.
4. Verify the runtime login can read `schema_migrations`, `cms_posts`, `cms_seo_audits`, and `module_work_items`, and can perform only the writes explicitly granted by the migration set.
5. Confirm the health endpoint returns HTTP 200 with no missing tables or migration markers.
6. Verify authenticated Owner and least-privilege staff flows for CRM, CMS, Finance, HR, Inventory, each operational module, Reports and AI Agent Console.
7. Configure a strong `CRON_SECRET` in the Production environment before relying on scheduled diagnostics. Verify an unauthenticated cron call returns 401 and an authorized dry-run completes before enabling the daily schedule.
8. Review backup/restore, access logs, monitoring and the owner approval path for every irreversible business action.

The migration sequence has been replayed successfully on a disposable Neon validation branch cloned from the Production baseline. The clone began with core markers 0001–0003; migrations 001–007 completed in order. Under the Production runtime login, the validation branch exposed all 21 required tables, all 7 required migration markers, the expected limited-role membership and the core module registry. This validation did not modify Production.

## Known launch boundaries

- This release is a single-organization operational deployment, not a multi-tenant SaaS release. CMS tables and multiple application routes still use the fixed Rundingan organization context. Before onboarding another organization, add organization ownership to CMS records and replace fixed organization slugs with authenticated organization membership/context throughout every API and workspace.
- Accounting is an operational journal foundation, not a complete statutory accounting suite. General Ledger, Trial Balance, Profit & Loss, Balance Sheet, tax calculations and bank reconciliation remain future work.
- Payroll does not calculate PPh 21, BPJS or THR automatically.
- Rental remains an optional entitlement only; full Rental workflows are not delivered.
- Human approval remains mandatory for journal posting, payroll payment, publication, purchasing, stock adjustments, deletion, code/schema changes and deployment.
