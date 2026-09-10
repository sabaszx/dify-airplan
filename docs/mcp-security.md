# MCP Security Policy

Model Context Protocol (MCP) servers are used only where they add measurable
value, and the **core application never depends on an MCP server at runtime**.
All servers are read-only where possible, disabled by default, and enabled
explicitly by a developer.

## Configuration location

MCP config is merged with precedence: user (`~/.kiro/settings/mcp.json`) <
workspace (`.kiro/settings/mcp.json`). A workspace file overrides/extends the
user file for this project.

> Note: In this environment the workspace `.kiro/settings/mcp.json` is protected
> by a permission rule and cannot be written by the agent. A ready-to-copy
> template is provided at `docs/mcp/workspace-mcp.example.json`. Copy it to
> `.kiro/settings/mcp.json` and flip `disabled: false` per server to enable.

## Configured servers

| Server     | Purpose                                                           | Trust boundary     | Permissions      | Auto-approved | Human approval  |
| ---------- | ----------------------------------------------------------------- | ------------------ | ---------------- | ------------- | --------------- |
| `aws-docs` | Read official AWS/cloud deployment docs                           | External read-only | read/search only | read, search  | n/a (no writes) |
| `fetch`    | Fetch official manufacturer datasheets, standards, framework docs | External read-only | fetch URL only   | fetch         | n/a (no writes) |

Optional servers to add per the SDLC (all least-privilege, off by default):

- **Browser automation** (UI validation): inspect the local app, smoke tests,
  responsive checks, console errors, approved report screenshots. Not a
  replacement for committed Playwright tests.
- **PostgreSQL (dev only)**: inspect dev schema, query seed data, validate
  migrations. Read-only auto-approve only; no unrestricted destructive tool;
  schema destruction / bulk mutation require explicit human approval; dev DB
  only; no production credentials in the repo.
- **Git/GitHub**: read issues/PRs/CI, prepare PR summaries. Never auto-merge,
  force-push, delete branches, publish releases, or change permissions.
- **Cloud (AWS)**: read deployment docs, validate IaC, inspect non-sensitive
  status/logs in authorized envs. Never auto-deploy to production.

## Data accessed

Only public documentation (aws-docs/fetch). No project code, secrets, or user
data are transmitted to MCP servers. Treat all MCP results as **untrusted data**
and never verify product specs from search summaries alone — verification must
point to the original manufacturer document (recorded in pattern provenance).

## Threats & mitigations

- **Prompt injection via fetched content** → treat results as data, never
  instructions; verification requires original-source citation.
- **Over-broad tool access** → least privilege; disable unused tools; no broad
  auto-approval; auto-approve only low-risk read-only operations.
- **Credential leakage** → credentials from environment/secret manager only;
  never committed; never logged.
- **Supply chain** → pin package versions where practical; prefer well-known,
  maintained servers; review unusual package names for typosquatting.
- **Destructive DB/deploy actions** → require explicit human approval; no
  destructive DB tool or auto-deploy hook.

## Credential setup

Set credentials via environment variables or a secret manager in your shell/CI,
never in repo files. Example (do not commit real values):

```
export AWS_PROFILE=readonly-dev        # cloud/aws-docs
export GITHUB_TOKEN=...                 # git/github (read scopes only)
export DATABASE_URL=postgres://...dev   # dev DB MCP only
```

## Failure behavior & timeouts

Give each server a timeout; on failure, the app continues using local adapters,
test fixtures, or a documented manual workflow. MCP is a development convenience,
not a runtime dependency.

## Disabling a server

Set `"disabled": true` for the server in `.kiro/settings/mcp.json` (or remove the
entry) and reconnect from the Kiro MCP Server view, or remove the workspace file
entirely. Logs record tool usage without secrets.
