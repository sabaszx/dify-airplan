---
inclusion: always
---

# Directory structure & dependency boundaries

```
src/
  domain/      Entities + Zod schemas, factory, model-change logic (no React)
  geometry/    Pure vector math, intersection, snapping helpers (no React)
  rf/          RF engine: pathloss, antenna gain, engine, channel, capacity, phyrate
  antenna/     Pattern schema, import/validation, gain interpolation, library, selection
  catalog/     Cisco AP catalog data (JSON) + schema + loader
  regulatory/  Regulatory-domain channel/power data
  editor/      Framework-independent editor logic: wall-drawing, wall-editing,
               snapping, hit-test, context-menu definitions
  store/       Zustand editor store + command stack
  workers/     Simulation Web Worker + client wrapper
  lib/         units, viewport, tokens, heatmap-colors, export, scenario-metrics,
               storage/env adapters, i18n
  components/  React UI (shell/, workspace/, antenna/, ui/)
  app/         Next.js routes + API route handlers
```

## Dependency rules
- `domain`, `geometry`, `rf`, `antenna`, `catalog`, `regulatory`, `editor` MUST NOT
  import React or `components/`.
- `components/` and `app/` may import the pure layers, never the reverse.
- Canvas rendering (`components/workspace/DesignCanvas`) stays separate from
  persistent domain data (`domain/`); it reads domain objects and emits intents.
- Persistence goes through the `ProjectStore` adapter (`lib/storage.ts`).
