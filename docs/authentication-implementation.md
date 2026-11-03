# Authentication and access control — development

## Provisioning state
- Neon Managed Auth (Better Auth) is provisioned only on the Neon `development` branch.
- The Auth endpoint, database connection, and cookie secret are stored as encrypted Vercel Preview variables scoped to `feat/master-data-and-auth`.
- `DATABASE_URL` uses a dedicated `rundingan_app` PostgreSQL login with limited grants, not the database owner role.
- Production Neon and Vercel environments have not been modified.
- The exact branch Preview origin is registered as a trusted Neon Auth domain.

## Application integration
- Next.js is upgraded to the supported 16.x line for the current Neon Next adapter.
- Neon Auth packages are pinned to compatible beta releases: `@neondatabase/auth@0.6.0-beta` and `@neondatabase/auth-ui@0.4.0-beta`.
- Email/password Auth UI is wired through the same-origin `/api/auth/*` proxy.
- Only `/workspace/*` is protected by the Next.js proxy. Private API handlers independently check the session and return 401 when unauthenticated.
- Private database and authorization modules are marked server-only.
- Social OAuth is not configured. Company-owned provider credentials are required before enabling it.
- Development Auth currently allows email/password signup without mandatory email verification. Do not invite public users or treat signup as an authorization grant; no operational permissions are assigned automatically.

## Authorization model
- Neon Auth manages identity. Application authorization is stored in `roles`, `permissions`, `role_permissions`, and `user_role_assignments`.
- Neon Auth user IDs are stored as text; application tables do not depend on Neon-managed internal table names.
- Access can be organization-wide or scoped to a business unit.
- Composite foreign keys prevent cross-organization role, unit, department, location, party-contact, and audit references.
- Role assignments use partial unique indexes to prevent duplicate active assignments while preserving revocation history.
- No user has been assigned Owner or Administrator.
- Every private API checks both the authenticated session and required permission in server-side code. UI visibility is not authorization.
- RLS remains disabled until authenticated database access and all required policies are implemented and tested.

## Required verification before real users
1. Sign-up, sign-in, sign-out, and session restoration.
2. Email verification behavior and custom SMTP production readiness.
3. Public pages remain public; workspace redirects without a session.
4. Direct unauthenticated private API requests return 401.
5. Cross-unit and cross-organization authorization tests deny access.
6. Role assignment, revocation, and audit logging.
7. Production-only credentials, trusted domains, and database role are configured separately after approval.
