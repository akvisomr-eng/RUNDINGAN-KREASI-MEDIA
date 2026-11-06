# MEDIA database migrations

Target: dedicated Neon PostgreSQL database `db_media`.

## Rules
- Never point MEDIA migrations at the Enterprise Core database or another specialist database.
- Run migrations only with the dedicated MEDIA migration role.
- Runtime uses only the `media_app` role.
- Do not place credentials in repository files.
- Migrations are applied manually through a reviewed release step, never automatically on app startup.
- Test first on the Neon `development` branch and verify a backup/recovery point before production.

## Tenant context
Migration `0001_media_foundation.sql` enables RLS on tenant-owned tables. Every server-side data transaction must establish the authenticated organization context using a transaction-local setting:

```sql
BEGIN;
SELECT set_config('app.organization_id', '<verified-organization-uuid>', true);
-- Execute tenant-scoped SQL in this same transaction.
COMMIT;
```

The organization ID must come from a validated Enterprise Core membership/authorization result, never from an untrusted browser form or query parameter. The application must still enforce authentication and permissions before querying. RLS is defense in depth, not a substitute for API authorization.

Before production: test positive access, cross-organization denial, missing-context denial, pooled-connection context reset, foreign-key tenant consistency, and migration rollback/forward-fix.
