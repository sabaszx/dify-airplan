# Cisco Catalog

Specifications are DATA, not hardcoded UI logic: `src/catalog/cisco-aps.json`
validated by `src/catalog/schema.ts`, loaded via `src/catalog/index.ts`.

## Fields

Manufacturer, family, model, SKU, environment, Wi-Fi generation, supported
bands, radio configs (max spatial streams, channel widths, min/max Tx power),
antenna (integrated/pattern/gain/beamwidth), Ethernet, PoE, environmental
rating, management mode, controller/regulatory notes, datasheet URL, optional
`patternRefs`, `catalogDataVersion`, `productRevisionId`, `lastVerified`,
`dataSource`, `verified`.

## Verification

Every seeded value is `verified: false` (sample/unverified). Do not invent
authoritative Cisco specifications. Verified data must cite official
manufacturer documentation via `PatternProvenance`. Reports display
"Verify with official Cisco documentation".

## Revisioning

Product/pattern revisions are immutable. APs store a `catalogSnapshot`
(product/sku/revision/catalog version + capture time) so future catalog updates
never silently change existing projects. Model change is one undoable command
with a compatibility summary (`src/domain/model-change.ts`).

## Branding

No Cisco logos or copyrighted datasheet content. Text labels and neutral
placeholders only.
