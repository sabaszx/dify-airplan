# Known Limitations

Stated honestly so the product is not misrepresented as production-complete.

## RF model
- 2D single-floor propagation; no inter-floor leakage, reflection, multipath, or
  angle-of-incidence terms.
- PHY/throughput/capacity are lookup-based planning estimates, not measurements.
- All outputs are predictive; validate with an on-site survey.

## Catalog & patterns
- Cisco specifications and antenna patterns are SAMPLE / UNVERIFIED until
  imported from official documentation with recorded provenance.
- The sample pattern library covers a few models; others use the labeled
  fallback. Datasheet-image digitization is specified but the UI is not built.

## Persistence & multi-tenancy
- MVP persists client-side (localStorage) behind the `ProjectStore` adapter.
  PostgreSQL/Prisma, Auth.js, object storage + signed URLs, and server-side
  organization isolation are specified and modeled but not yet enforced at
  runtime.

## Reporting
- Reproducible report snapshot + CSV/JSON exports + HTML report are implemented
  and tested. The full 29-section PDF layout, interactive report-builder UI,
  server-side PDF renderer, and automated visual PDF inspection are partial.

## Testing
- Unit, property-based, and E2E suites exist and pass. Integration tests against
  a real DB/API, API contract tests, visual-regression, automated accessibility
  (axe), CI performance budgets, and security fuzzing are specified but not built.

## Platform
- Next.js is pinned at 14.2.15 (has a published advisory); bump to a patched
  14.2.x before production.
- Accessibility: automated checks are a floor; full WCAG 2.2 AA conformance
  needs manual assistive-technology testing and expert review. The canvas is not
  yet exposed as an equivalent navigable object list for AT users.

## Not production-ready
Per docs/release-checklist.md, several mandatory gates (server-side authz,
migrations from a clean DB, integration/security suites) are not yet satisfied.
Do not represent this build as production-ready.
