# AGENTS.md — Cisco Wi-Fi Planner

Concise repository-wide rules for AI agents and contributors. Detailed guidance
lives in `.kiro/steering/` (auto-included by matching topic).

## Golden rules

- Predictive RF outputs are estimates, never measurements — always show the disclaimer.
- Cisco specs & antenna patterns are sample/unverified until imported from official
  docs with recorded provenance. No Cisco logos or copyrighted datasheet content.
- SI units internally (meters/dBm/GHz); real-world meter coordinates for objects.
- Keep `domain/`, `geometry/`, `rf/`, `antenna/`, `catalog/`, `editor/` free of React.
- Every canvas mutation is an undoable Command; drags coalesce to one entry.
- Immutable catalog/pattern revisions; APs carry a `catalogSnapshot`.
- No secrets in source; validate config via `src/lib/env.ts`.
- Add tests with every behavioral change; update docs when behavior changes.
- Never mark a task done or claim "tests pass" without running the verification commands.
- No placeholder controls or TODO-only implementations in completed tasks.

## Verification

```
npm run typecheck && npm run lint && npm test && npm run build
npx playwright install chromium && npm run test:e2e
```

## Steering map

product / tech / structure / architecture / security / definition-of-done
(always). canvas-editor, rf-domain, antenna-patterns, cisco-catalog, reporting,
testing, api-standards, database-standards, ux-design-system, accessibility,
observability (auto by topic). Specs: `.kiro/specs/cisco-wifi-planner/`.
