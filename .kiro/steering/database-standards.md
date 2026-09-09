---
inclusion: auto
name: database-standards
description: Apply when creating or modifying database schema, migrations, or repositories.
---

# Database standards

- Target PostgreSQL with a migration tool (Prisma recommended). The MVP persists
  client-side via the `ProjectStore` adapter (`src/lib/storage.ts`); the DB
  adapter implements the same interface.
- Every tenant-scoped table carries `organization_id`; queries filter by it.
- Keep audit fields (`created_at`, `updated_at`, `updated_by`) on important rows.
- Immutable catalog/pattern revisions: never mutate a published revision; create
  a new one. Projects reference the revision used at design time.
- Migrations must apply cleanly from an empty database and be reversible where
  practical. Test migrations in CI.
- No production credentials in the repo; connection strings come from env.
