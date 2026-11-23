# Rundingan Kreasi Media

Integrated media and creative business platform.

## Business units
- Rundingan Media
- Rundingan Academy
- Rundingan Rental
- Rundingan Production
- Rundingan Creative
- Rundingan Event
- Corporate Management

## Architecture
- Next.js and TypeScript web platform
- Supabase PostgreSQL shared source of truth and Supabase Auth
- Modular monolith and API-first architecture
- Server-side PostgreSQL access uses `postgres` through Supabase's transaction pooler; Supabase Auth SSR uses `@supabase/ssr`
- Offline-capable desktop client planned with Tauri, SQLite and sync queue

## Development and release status
Use Development project `qlwnyvwmnzvcvfodhzic` (`RUNDINGAN-KREASI-MEDIA-DEV`, `ap-southeast-1`) for application testing. Core and application migrations `0001`–`015` are applied there; the Supabase database and Auth/REST/Storage services are healthy. Production project `sgvyyawjjkdvemobtumz` remains unchanged and has no application schema yet.

Configure `DATABASE_URL` with the dedicated `rundingan_runtime_web` pooler login (member of `rundingan_app_limited`), plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The server rejects database URLs that don't use that runtime login; never use the `postgres` owner or `service_role` for the web app. Deployment secrets, the runtime login, production migration approval/backup, and email/deployment-domain setup are still required before launch. Do not commit secrets or apply Development changes to Production.

See `docs/authentication-implementation.md`, `docs/PRODUCTION-RELEASE-CHECKLIST.md`, and `docs/dedicated-operations-modules.md` for setup and remaining release gates.
