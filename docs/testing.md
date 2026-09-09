# Testing

See `.kiro/steering/testing.md` for rules.

## Suites
- **Unit** (Vitest): geometry, wall intersections, snapping, coordinate/scale
  conversion, path loss, wall/opening attenuation, antenna interpolation and
  gain, channel validation, capacity, catalog, model change, report snapshot,
  exports, health/readiness routes, command stack.
- **Property-based** (fast-check, deterministic seeds): distance/attenuation
  monotonicity, circular-interpolation continuity, invalid channels never
  assigned, omni rotation invariance, serialize roundtrip, undo/redo
  equivalence, org isolation. Files: `src/**/invariants.property.test.ts`.
- **E2E** (Playwright): dashboard create + persistence; continuous wall drawing;
  AP placement + undo/redo; AP editor (double-click); context menus (AP vs wall,
  Shift+F10, viewport clamp, native menu outside canvas); model change preserves
  position + undoable. Seeded via `e2e/helpers.ts`.

## Commands
```
npm run typecheck
npm run lint
npm test                 # unit + property-based
npx playwright install chromium && npm run test:e2e
npm run build
```

## Not yet implemented (documented)
Integration tests against a real DB/API, API contract tests, visual-regression
snapshots, automated accessibility (axe) runs, performance budgets in CI, and
security fuzz tests are specified in the SDLC but not yet built. These are the
recommended next quality investments.
