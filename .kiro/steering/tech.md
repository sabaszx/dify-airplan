---
inclusion: always
---

# Tech stack & conventions

- Frontend: Next.js (App Router), React 18, TypeScript strict, Tailwind CSS.
- State: Zustand editor store with command-based undo/redo.
- Validation: Zod at all trust boundaries (imports, persisted data).
- Canvas: native `<canvas>` renderer (`DesignCanvas`), pure geometry in `src/geometry`.
- RF engine: framework-independent TypeScript in `src/rf` (no DOM, deterministic).
- Tests: Vitest (unit + property-based via fast-check), Playwright (E2E).
- Tooling: ESLint (next/core-web-vitals), Prettier, `tsc --noEmit`.

## Conventions
- SI units internally (meters, dBm, GHz); convert only for display.
- Real-world meter coordinates for all objects; pixels are a render transform.
- Named exports; `@/*` path alias to `src/*`.
- Pin dependency versions. Prefer well-known, maintained packages.
- No secrets in source. Read config via `src/lib/env.ts` (Zod-validated).

## Commands
- Dev: `npm run dev` · Build: `npm run build` · Start: `npm run start`
- Verify: `npm run typecheck && npm run lint && npm test`
- E2E: `npx playwright install chromium && npm run test:e2e`
