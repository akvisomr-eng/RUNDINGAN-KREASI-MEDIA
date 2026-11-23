# Media database migrations

Target: an explicitly approved Supabase PostgreSQL project/schema for the independent Media runtime; target project/environment has not yet been confirmed.

- Migration files are additive and PostgreSQL-compatible.
- Apply through a reviewed migration process after confirming whether Media shares the Enterprise project or requires an isolated Supabase project.
- Verify recovery/backup and permissions before Production changes.
- Do not use project-owner credentials for runtime access.
