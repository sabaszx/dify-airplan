# ADR 0001: Framework-independent RF engine

- Status: Accepted
- Date: 2026

## Context

RF prediction must be deterministic, testable without a browser, and replaceable
by a stronger propagation model later.

## Decision

Implement the RF engine in pure TypeScript under `src/rf/` with no DOM/React
dependencies. Run heavy simulation in a Web Worker via a thin client wrapper.
Keep the model modular (path loss, antenna gain, engine orchestration) so a
future model can replace `pathloss.ts`/`engine.ts` behind stable interfaces.

## Consequences

- Fast, deterministic unit + property-based tests under Node.
- UI stays responsive (worker offload).
- Slight duplication of type definitions across the worker boundary (acceptable).
