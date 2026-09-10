# Deployment

## Local

```
npm install
cp .env.example .env.local     # fill optional values
npm run dev                    # http://localhost:3000
docker compose up -d           # optional local Postgres
```

## Production build

```
npm run build && npm run start
```

## Container

The `Dockerfile` produces a minimal standalone image (Next.js `output:
standalone`, non-root user, HEALTHCHECK on `/api/health`).

```
docker build -t cisco-wifi-planner:latest .
docker run -p 3000:3000 --env-file .env.production cisco-wifi-planner:latest
```

## Environments

Local → Test → Staging → Production. CI (`.github/workflows/ci.yml`) runs
verify + e2e + container build, then would deploy to staging and smoke-test.
**Production deploy requires a manual approval gate** (GitHub Environments
protection rule) and is not automated.

## Configuration

All config via environment variables (see `.env.example`), validated by
`src/lib/env.ts`. No secrets in the repo or CI config. Use environment-specific
config and a secret manager.

## Health & rollback

- Liveness: `GET /api/health`. Readiness: `GET /api/ready`.
- Rollback: redeploy the previous immutable image tag; run DB migration down
  only when safe (see docs/backup-restore.md). Keep the last known-good tag.

## Recommended hardening before production

Bump Next.js to a patched 14.2.x (current pin has an advisory); wire the
PostgreSQL/Auth.js adapters with server-side authorization; move file storage to
object storage with signed URLs; enable rate limiting on simulate/export.
