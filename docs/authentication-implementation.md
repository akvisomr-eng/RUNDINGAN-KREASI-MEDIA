# Authentication and access control — development

## Provisioning state
- Neon Managed Auth (Better Auth) has been provisioned only on the Neon development branch.
- Auth endpoint is branch-specific; read it from Neon project configuration and store it as `NEON_AUTH_BASE_URL` in Vercel Preview environment variables.
- Never commit auth URLs containing credentials, cookie secrets, provider secrets, or database URLs.
- Production Neon branch has not been provisioned or changed.

## Application integration prerequisites
- The app currently uses Next.js 15.5.28. Current `@neondatabase/auth/next` integration declares a Next.js 16+ peer requirement; do not install it into the existing app until the framework upgrade is separately reviewed and CI passes.
- Upgrade to a supported stable Next.js 16 patch, then add the pinned `@neondatabase/auth` and `@neondatabase/auth-ui` dependencies.
- Implement the auth proxy route, sign-in/sign-up/recovery views, session-aware navigation, and route protection. Keep public marketing pages and static assets public.
- Use email/password initially. Social OAuth requires company-owned OAuth credentials and is intentionally not configured.
- Generate a unique `NEON_AUTH_COOKIE_SECRET` (32+ characters) and set it only in Vercel Preview environment variables.
- Add each exact Vercel Preview/production origin to the Neon Auth trusted-domain allowlist before using redirects.

## Authorization model
- Identity is managed by Neon Auth. App authorization lives in `roles`, `permissions`, `role_permissions`, and `user_role_assignments`.
- Neon Auth user IDs are stored as text; application tables do not depend on Neon-managed internal table names.
- Access can be organization-wide or scoped to a business unit.
- Never grant Owner or Administrator automatically to the first person who signs up. Initial owner assignment requires an explicit, verified administrative action.
- Enforce permissions in server-side route handlers and domain services; hiding UI controls is not authorization.
- Do not enable RLS until authenticated DB access and all required policies have been implemented and tested.

## Required verification before enabling login for real users
1. Sign-up and email verification.
2. Sign-in, sign-out, and session restoration after reload.
3. Protected routes redirect correctly while public pages remain public.
4. Direct unauthenticated API requests return 401.
5. Cross-unit and cross-organization authorization tests deny access.
6. Role assignment, revocation, and audit logging.
