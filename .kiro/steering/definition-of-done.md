---
inclusion: always
---

# Definition of Done

A task/slice is done ONLY when all apply:
- Behavior is implemented (no placeholder controls in completed workflows).
- Tests added for the behavior; the required tests pass.
- `npm run typecheck` passes (strict, no errors).
- `npm run lint` passes (no warnings).
- Relevant `npm test` suites pass.
- Documentation updated when behavior changed.
- Verification commands were actually executed (never claim "all tests pass"
  without running them).
- Migrations present when schema changed; security-sensitive changes reviewed.

A task is NEVER complete merely because code was generated. Report honestly which
gates pass, which are partial, and which are not implemented.
