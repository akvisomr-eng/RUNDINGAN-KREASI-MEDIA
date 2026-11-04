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

Development has been updated and verified separately. Production migration is a separate release operation and must be approved and backed up before execution.
