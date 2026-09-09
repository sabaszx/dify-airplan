# Antenna Pattern Format

Schema: `src/antenna/schema.ts` (Zod) with a JSON Schema mirror
(`ANTENNA_PATTERN_JSON_SCHEMA`).

## Structure
```
{
  "schemaVersion": "1.0",
  "id": "...", "revision": 0,
  "manufacturer": "Cisco", "model": "...",
  "antenna": { "name", "type", "internal", "polarization",
               "coordinateSystem": "spherical",
               "orientation": { "forwardAxis", "upAxis" }, "downtiltDeg" },
  "patterns": [ { "frequencyMHz", "peakGainDbi",
                  "azimuth": [{ "angleDeg", "gainDbi" }],
                  "elevation": [{ "angleDeg", "gainDbi" }],
                  "beamwidthDeg?", "frontToBackDb?" } ],
  "source": { "type", "url?", "document?", "lastVerified" },
  "verificationStatus": "sample",
  "originalImport?": <preserved raw payload>
}
```

## Import formats (`src/antenna/import.ts`)
Native JSON, azimuth CSV, elevation CSV, combined CSV (`freq,cut,angle,gain`),
and best-effort MSI Planet. A `PatternImporter` adapter allows future vendor
formats. A 2D polar-plot image is NOT accepted as structured data; store the
image reference and digitize manually (flagged `extracted-from-datasheet`).

## Validation
`validatePattern` checks metadata, frequency range, angle ranges, duplicate
angles, gain sanity, and 0/360 coverage; returns errors + warnings. Invalid
patterns are not saved unless kept as a draft.

## Gain computation
Circular interpolation across 0/360; documented additive 2-cut combination.
Automatic transforms preserve the original samples and create a derived revision.

## Provenance & verification states
`PatternProvenance` records document title/type, URL, revision, dates,
page/figure/table, gain type (absolute vs relative), importer, and status:
draft / sample / extracted-from-datasheet / manually-reviewed /
manufacturer-verified / deprecated. Do not invent data absent from official
documentation; cite the original source.
