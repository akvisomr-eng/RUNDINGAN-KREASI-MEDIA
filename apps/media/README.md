# RUNDINGAN MEDIA

Standalone specialist application workspace for the MEDIA business unit. This folder is deliberately isolated from the Enterprise Core application and is structured to be extracted into its own GitHub repository when repository-creation access is available.

## Stack
- Next.js App Router
- React + TypeScript
- Neon PostgreSQL (dedicated database: `db_media`)
- Vercel deployment (separate project planned)

## Local development
```bash
cd apps/media
npm install
cp .env.example .env.local
npm run dev
```

## Environment
Set `DATABASE_URL` to the MEDIA runtime-role connection string for the matching Neon branch. Never use the Neon project owner or migration credential as the runtime URL. Set `CORE_API_BASE_URL` and `CORE_SERVICE_TOKEN` only after Enterprise Core exposes the approved service API. Secrets must be configured in the dedicated Vercel project, never committed to Git.

## Current scope
- Independent app shell and MEDIA workspace navigation
- Editorial, publication, asset-rights, advertising, audience, and integration modules as staged navigation
- Read-only health endpoint that reports configuration presence without revealing secret values
- Dedicated database connection boundary

## Security gates before production
1. Complete central identity/OIDC integration and server-side permission checks.
2. Add organization-scoped data access and tested RLS policies.
3. Add audited editorial approval and publication workflows.
4. Add signed, idempotent Core billing/event integration.
5. Configure Preview first; perform UAT and security tests before Production.

This workspace is a development foundation, not a production-ready newsroom or CMS.
