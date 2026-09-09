---
inclusion: auto
name: testing
description: Apply when creating or modifying test files, test configuration, or CI test steps.
---

# Testing guidance

- Unit + property-based: Vitest (+ fast-check) in `src/**/*.test.ts`.
- E2E: Playwright in `e2e/*.spec.ts`, seeded via `e2e/helpers.ts` (localStorage
  init scripts). Use stable data-testids; wait for autosave to flush before
  reading persisted state.
- Add tests with every behavioral change. Do not commit `.only`/`.skip`/focused
  tests. Do not hide or delete failing tests.
- Property-based invariants live in `src/**/*.property.test.ts` with deterministic
  seeds; preserve minimal failing examples.
- Verification commands: `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run test:e2e`, `npm run build`.
- Never report "all tests pass" unless the reported commands were actually run.
