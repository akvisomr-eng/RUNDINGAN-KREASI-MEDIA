# RUNDINGAN KREASI MEDIA — Enterprise Architecture

**Status:** Proposed architecture baseline  
**Version:** 1.0  
**Decision date:** 2026-11-06

This document defines the target architecture for one Enterprise Core and six independently deployable specialist applications.

## Architecture decision

Use a hybrid database model:

- Enterprise Core remains in its own Neon project and owns shared enterprise capabilities.
- Six specialist applications use six independent PostgreSQL databases.
- During the initial stage, those six databases may reside in one separate Neon project to control infrastructure overhead.
- Each application has its own GitHub repository, Vercel project, runtime configuration, database role, migration history, backup/restore procedure, and release lifecycle.
- A specialist database can later move to its own Neon project without changing business ownership or API contracts.

The six specialist applications are RUNDINGAN MEDIA, ACADEMY, RENTAL, PRODUCTION, CREATIVE, and EVENT.

## Logical topology

```text
                         RUNDINGAN ENTERPRISE CORE
                     Identity / Organization / Master Data
                       Central Finance / HRM Core / BI
                              Integration Hub
                                    |
                         Versioned API + Events
                                    |
             +----------------------+----------------------+
             |                      |                      |
         MEDIA DB              ACADEMY DB              RENTAL DB
             |                      |                      |
       MEDIA APP              ACADEMY APP              RENTAL APP
             |
       (same independent pattern for PRODUCTION, CREATIVE, EVENT)
```

## Ownership boundaries

Enterprise Core is authoritative for:
- user identity and organization membership;
- organizations, business units, and shared master identifiers;
- canonical customer/supplier identity where group-wide identity is required;
- employee identity and central HR policy references;
- central chart of accounts, accounting periods, general ledger, and consolidated reporting;
- application registry, integration credentials, audit governance, and SaaS entitlements.

Each specialist application is authoritative for its own operational records:
- Media: editorial, newsroom, publication, media inventory, advertising operations.
- Academy: courses, cohorts, enrollment, attendance, assessments, certificates.
- Rental: rentable assets, availability, reservations, contracts, handover, maintenance.
- Production: production projects, scripts, schedules, crew assignments, production assets and costs.
- Creative: creative briefs, design projects, brand assets, review rounds, deliverables.
- Event: events, venues, ticketing, participants, suppliers, run-of-show, event operations.

Specialist applications may keep a local, read-optimized projection of approved shared master data. Such projections are caches/reference copies, not a second authoritative master. They must include the source ID, source version, synchronization timestamp, and deletion/deactivation state.

## Integration principles

1. No application reads or writes another application's database.
2. Cross-application data moves through authenticated, versioned APIs or signed events.
3. Every command that can create a financial or operational side effect has an idempotency key.
4. Events are delivered at least once; consumers must be idempotent.
5. Use an outbox/inbox pattern for reliable event publication and consumption.
6. Finance posting is performed by Enterprise Core. Specialist apps submit approved source transactions and retain the returned journal reference.
7. Do not treat a UI permission or hidden menu as server-side authorization.
8. Each app must be independently deployable and must degrade gracefully when another app is unavailable.

## Environments

Each application has independent development, preview/staging, and production configuration. Database migrations are versioned with the owning application and tested against a non-production branch/database before production application.

## Non-goals

- A shared database schema for all seven applications.
- Direct SQL access from one application into another application's database.
- Duplicating the general ledger in each specialist application.
- Building all six specialist applications simultaneously.
- Moving existing production data before an explicit migration and acceptance plan.

## Delivery sequence

1. Audit and harden Enterprise Core.
2. Implement the shared integration contract and identity model.
3. Provision the six specialist databases in the specialist Neon project.
4. Deliver RUNDINGAN MEDIA as the first integration pilot.
5. Deliver ACADEMY and RENTAL.
6. Deliver PRODUCTION and CREATIVE.
7. Deliver EVENT.
8. Complete cross-system UAT, security testing, backup recovery testing, and SaaS readiness review.

See the linked architecture documents in this directory for ownership, API, security, and deployment details.
