# Rundingan Media runtime

A separate Next.js service for media operations. It is intended to use Supabase PostgreSQL for media-owned records and the Enterprise Core API for shared company data.

## Environment

Set `DATABASE_URL` to the approved restricted runtime connection for the Supabase PostgreSQL target. Never use the project-owner credential as the runtime URL. Set `CORE_API_BASE_URL` and `CORE_SERVICE_TOKEN` only after Enterprise Core exposes the approved service API. Set `NEXT_PUBLIC_APP_URL` to the exact deployment origin. Secrets belong in the dedicated deployment's secret store, never in Git.

The media-specific schema under `db/migrations/` has not been applied to the active Supabase project. Confirm whether Media shares the main project or uses a separately provisioned project before migration.
