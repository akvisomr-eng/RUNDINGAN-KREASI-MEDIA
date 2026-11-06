# Hybrid Database Provisioning and Delivery Plan

## Initial target layout

| Neon project | PostgreSQL database | Application |
|---|---|---|
| Existing Enterprise Core project | Existing Core database | Enterprise Core |
| New specialist project | `db_media` | RUNDINGAN MEDIA |
| New specialist project | `db_academy` | RUNDINGAN ACADEMY |
| New specialist project | `db_rental` | RUNDINGAN RENTAL |
| New specialist project | `db_production` | RUNDINGAN PRODUCTION |
| New specialist project | `db_creative` | RUNDINGAN CREATIVE |
| New specialist project | `db_event` | RUNDINGAN EVENT |

The Core project's identity must be verified from the production runtime configuration before it is treated as authoritative. The existing similarly named Neon project that has not been assigned a role remains untouched pending a separate audit.

## Provisioning sequence

1. Confirm the Neon organization, region, plan, quotas, storage, compute, and expected cost.
2. Confirm the specialist project name and owner.
3. Create a non-production branch for provisioning/migration tests.
4. Create the six PostgreSQL databases with the approved names.
5. Create one runtime role per app and a separate migration role per app.
6. Revoke unnecessary PUBLIC database/schema privileges and grant only required access.
7. Apply a minimal baseline schema and migration registry independently in each database.
8. Configure only the matching app's Vercel Preview variables.
9. Verify database isolation with positive and negative connection tests.
10. Configure production credentials only after application UAT and an explicit release approval.

Do not create the specialist Neon project or databases until quota, cost, ownership, and account limits are confirmed. Do not place any new app on the Enterprise Core production database.

## Repository and deployment layout

| App | GitHub repository | Vercel project | Planned hostname |
|---|---|---|---|
| Enterprise Core | `RUNDINGAN-KREASI-MEDIA` | `rundingan-kreasi-media` | `app.rundingan.id` |
| Media | `RUNDINGAN-MEDIA` | `rundingan-media` | `media.rundingan.id` |
| Academy | `RUNDINGAN-ACADEMY` | `rundingan-academy` | `academy.rundingan.id` |
| Rental | `RUNDINGAN-RENTAL` | `rundingan-rental` | `rental.rundingan.id` |
| Production | `RUNDINGAN-PRODUCTION` | `rundingan-production` | `production.rundingan.id` |
| Creative | `RUNDINGAN-CREATIVE` | `rundingan-creative` | `creative.rundingan.id` |
| Event | `RUNDINGAN-EVENT` | `rundingan-event` | `event.rundingan.id` |

Repository, Vercel project, and hostname names above are intended naming conventions. They are not evidence that those resources or domains already exist.

## Migration and backup policy

- Each app owns its schema and migration history.
- Never run an app migration against another app's database.
- Test migrations against a non-production branch or disposable database.
- Use direct, non-pooled connection for migrations and pooled connection for ordinary runtime traffic.
- Take and verify a recovery point before production migrations.
- Document rollback/forward-fix strategy and data compatibility.
- Test restore from backup before production acceptance.
- Keep database and object-storage retention aligned with the app's legal and operational requirements.

## Promotion gates

Development -> Preview/Staging -> Production.

Promotion requires successful typecheck/build, database migration test, API contract tests, security tests, health checks, and business UAT. A successful Vercel deployment alone is not production acceptance.

## Scale-out trigger

Move one specialist database to its own Neon project when one or more is true:
- its compute/storage/transfer needs diverge materially;
- it needs independent backup/restore or maintenance windows;
- security or customer contract requires stronger isolation;
- app-specific scaling or availability requires independent compute;
- shared-project quotas or operational coupling become a constraint.

The move must preserve stable organization IDs, source record IDs, API contracts, and event identities.
