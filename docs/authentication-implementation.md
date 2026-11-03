# Authentication and access control — development

## Provisioning state
- Neon Managed Auth (Better Auth) is provisioned only on the Neon `development` branch.
- The Auth endpoint and database connection are stored as encrypted Vercel Preview variables scoped to `feat/master-data-and-auth`.
- A unique cookie secret is stored as an encrypted Preview variable. No secrets or database URLs are committed.
- Production Neon and Vercel environments have not been modified.

## Application integration
- Next.js is upgraded to the supported 16.x line for the current Neon Next adapter.
- Neon Auth packages are pinned to compatible beta releases. Keep `@neondatabase/auth` at `0.6.0-beta` while `@neondatabase/auth-ui` is `0.4.0-beta`; the latter declares the matching peer dependency.
- Email/password sign-in and Auth UI routes are wired through the same-origin `/api/auth/*` proxy.
- Only `/workspace/*` is protected by the Next.js proxy. Private API handlers independently check the session and return 401 when unauthenticated.
- Social OAuth is not configured. Company-owned provider credentials are required before enabling it.

## Authorization model
- Neon Auth manages identity. Application authorization is stored in `roles`, `permissions`, `role_permissions`, and `user_role_assignments`.
- Neon Auth user IDs are stored as text; application tables do not depend on Neon-managed internal table names.
- Access can be organization-wide or scoped to a business unit.
- The initial role/permission seed is a baseline only. No user has been assigned Owner or Administrator.
- Every private API must check both the authenticated session and the required permission in server-side code. UI visibility is not authorization.
- Do not enable RLS until authenticated database access and all required policies have been implemented and tested.

## Required verification before real users
1. Sign-up, sign-in, sign-out, and session restoration.
2. Email verification behavior and SMTP production readiness.
3. Public pages remain public; workspace redirects without a session.
4. Direct unauthenticated private API requests return 401.
5. Cross-unit and cross-organization authorization tests deny access.
6. Role assignment, revocation, and audit logging.
