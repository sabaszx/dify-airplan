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

## GitHub Actions deployment to el-dorado

The `CI/CD Ubuntu` workflow runs formatting, lint, type checks, unit tests,
Playwright tests, and a Docker image smoke test on GitHub-hosted runners.
The missing optional `public` directory is created during the Docker build.
Only an image that passes all checks is exported as a seven-day Actions artifact.
PRs never run jobs on the Ubuntu production runner.

The existing self-hosted runner must be online on `el-dorado`, labelled
`self-hosted`, `Linux`, `X64`, with Docker available to its service account.
No SSH key, GHCR credential, or inbound public SSH port is required.
The runner currently started with `./run.sh` must stay running; install it as
an operating-system service for unattended use, following GitHub's runner setup.

Create/configure the `production` GitHub Environment with required reviewers
and restrict deployment branches to `main` before enabling production releases.
Environment protection rules are configured in GitHub Settings; declaring
`environment: production` in YAML alone does not create an approval rule.

To deploy: Actions > CI/CD Ubuntu > Run workflow > branch main > enable deploy.
For deployment after every successful main push, set repository variable
`AUTO_DEPLOY=true`; environment approval still applies when configured.
By default pushes only run CI and export the tested image.

Optional repository/environment variables:
- `APP_PORT`: host port, default `3000`.
- `BIND_ADDRESS`: host IPv4 address, default `127.0.0.1`. Use the server's LAN
  address when LAN access is intended, or place an existing reverse proxy in
  front of the loopback port. The workflow does not change firewall rules.

The application is installed as Docker container `air-plan`, with restart
policy `unless-stopped`; no source checkout or deployment directory is needed.
A pre-existing container of that name is replaced only if labelled
`io.air-plan.managed=github-actions`. Existing unrelated containers are untouched.
The prior container is preserved while the new image starts. Failed health or
readiness checks remove the failed container and restart the prior one.
Successful deployments remove the stopped backup, retaining old Docker images
for manual rollback. No Docker prune or volume deletion is performed.
There is a brief interruption during replacement. This MVP stores projects in
browser localStorage, and the workflow does not provision a database or secrets.

Node 20 and the pinned application dependencies are retained to avoid combining
an application upgrade with this pipeline change. The dependency audit is
advisory, as before; review the existing production-hardening requirements above.
