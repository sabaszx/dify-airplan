# Release Checklist

## Pre-release gates (must pass)

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` (unit + property-based) passing
- [ ] `npm run test:e2e` passing (Playwright, chromium)
- [ ] `npm run build` succeeds
- [ ] `docker build` succeeds
- [ ] DB migrations apply from a clean database (when Postgres is wired)
- [ ] Org-isolation authorization tests pass
- [ ] A realistic project generates a valid report snapshot / PDF
- [ ] `.env.example` complete; no secrets committed
- [ ] Known limitations documented (docs/limitations.md)
- [ ] No high-severity unresolved security issue

## Versioning & changelog

Semantic version bump; update CHANGELOG with notable changes and migrations.

## Deploy

1. Build immutable image, tag with version.
2. Deploy to staging; run staging smoke test.
3. Manual approval gate for production.
4. Deploy to production; verify `/api/health` and `/api/ready`.
5. Record the deploy (audit trail).

## Rollback

Redeploy the previous known-good image tag; reverse migrations only when safe.

## Smoke test (post-deploy)

Create project → upload plan → calibrate → draw wall → place AP → simulate →
open context menu → generate report → download BOM → reload.
