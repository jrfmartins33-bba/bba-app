# Epic 21 — Structured Expected Cell Geometry Contract

Status: Commit 1 (frozen generic algorithm). Real data (pages 46/50/54) generated in Commit 2 of the same Sprint — see `EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md` for the concrete result and provenance.

## 1. Purpose

The reference truth (`discovery-reference-truth.ts` and its 1,019 cells, frozen in Sprint 21.4B.3A.3) declares, for every cell, a free-text provenance field `physicalOriginPt` (e.g. `"Segmento(s): <hash>"`) but no bounding box. `ReferenceTruthCell.physicalRegionIds` is `[]` on all 1,019 cells and is **never** retroactively filled by this Sprint.

This contract adds a **diagnostic-only, additive layer**, indexed by `cellId`, that projects a deterministic, auditable expected *geometry* (bounding boxes) for each cell, derived exclusively from:

- the already-frozen reference truth (cells, logical rows, physical regions, columns), and
- an independently reconstructed registry of physical text **segments** (segment key → bounding box), produced by the domain's own already-approved structural reconstructor (`observeDocumentSignals` → `locateBudgetDocumentPages` → `reconstructBudgetDocumentStructure`) run against the exact source PDF.

It exists to give a future deterministic-engine evaluator a real spatial ground truth. **It does not build that engine.**

## 2. Location and isolation

```
packages/bdos-core/src/domain/budget-document-location/tabular-region-detection/testing/discovery/reference-truth/cell-geometry/
```

Entirely under `testing/` (diagnostic, per the domain's existing production/diagnostic partition — see `budget-document-location-boundaries.test.ts`). Never exported by any public barrel. Never imported by production code. Isolation enforced by `packages/bdos-core/src/architecture/expected-cell-geometry-boundaries.test.ts`, which additionally forbids:

- importing PaddleOCR/Docling/local-reader-evaluation output, `results/corrected-v2`, or any v1/v2 result;
- importing a future deterministic engine;
- real page literals (46/50/54), real document hashes, or real-document vocabulary anywhere **outside** the real-data files (`*-page-46.ts`, `*-page-50.ts`, `*-page-54.ts`, `*-physical-segments-page-*.ts`, `*-manifest.ts`).

## 3. File map

| File | Role |
|---|---|
| `discovery-reference-truth-cell-geometry.types.ts` | Contract: `ReferenceTruthCellGeometry`, `ReferenceTruthCellGeometryFragment`, bounding-box/band primitives, projection input, integrity issue codes. |
| `discovery-reference-truth-cell-geometry-origin-parser.ts` | Strict parser for `physicalOriginPt` — accepts only `"Segmento(s): <64-hex>[, <64-hex>]*"`, preserves declared order, never repairs or infers. |
| `discovery-reference-truth-cell-geometry-geometry-helpers.ts` | Pure bbox helpers reused from the domain's own established conventions (union via min/max, horizontal intersection via `max(0, min(rights)-max(lefts))`). |
| `discovery-reference-truth-cell-geometry-projection.ts` | The generic algorithm — resolves row band, column band, segment(s), fragments, shared-geometry grouping, empty-slot projection. |
| `discovery-reference-truth-cell-geometry-validation.ts` | Independent post-hoc invariant checker (bbox validity, page containment, column/row intersection, envelope correctness, shared-group symmetry). |
| `discovery-reference-truth-cell-geometry-evaluator-projection.ts` | `projectReferenceTruthCellsWithGeometry` — the diagnostic port a future engine evaluator will consume. |
| `discovery-reference-truth-cell-geometry-svg.ts` | Deterministic SVG renderer (dev-time visual validation only, never a system input). |
| `discovery-reference-truth-cell-geometry.ts` | Barrel + `buildReferenceTruthCellGeometry` (projection + validation in one call). |
| `discovery-reference-truth-cell-geometry.test.ts` | Synthetic tests for every required scenario (Commit 1). |
| `discovery-reference-truth-cell-geometry-physical-segments-page-{46,50,54}.ts` | Commit 2: frozen registry of resolved physical segment boxes (segmentKey → box), scoped to the segments actually referenced by the 1,019 cells' `physicalOriginPt`. |
| `discovery-reference-truth-cell-geometry-page-{46,50,54}.ts` | Commit 2: frozen `ReferenceTruthCellGeometry[]` output for that page. |
| `discovery-reference-truth-cell-geometry-manifest.ts` | Commit 2: deterministic manifest (schema/hashes/counts). |
| `discovery-reference-truth-cell-geometry-real-data.test.ts` | Commit 2: integrity tests over the real 1,019-cell output. |

## 4. Data model

`ReferenceTruthCellGeometry` (one per cell, keyed by `cellId`):

- `resolutionKind`: `single_source_fragment` \| `multiple_source_fragments` \| `shared_source_geometry` \| `empty_slot_projection`.
- `spatialSemantics`: `exclusive` \| `shared` \| `multi_fragment` \| `empty_slot`.
- `fragments`: one `ReferenceTruthCellGeometryFragment` per resolved physical segment (order preserved from `physicalOriginPt`), each with `sourceSegmentKey`/`sourceBoundingBox` (raw physical evidence) and `projectedBoundingBox` (the cell-specific projection).
- `expectedEnvelope`: exact union of all of the cell's own fragments.
- `rowBand`: union bounding box of the logical row's own `physicalRegionIds` — independent evidence/validation, never the source of a segment-bearing cell's own vertical coordinate.
- `columnBand`: the column's frozen horizontal interval, verbatim.
- `sharedGeometryGroupId` / `sharedWithCellIds`: populated, symmetrically, whenever two or more cells resolve to the same `(page, segmentKey)`.
- `provenance`: full audit trail back to `physicalOriginPt`, the row's physical regions, and a human-readable note.

## 5. Fragment projection rule

```
fragment.projectedBoundingBox =
  segment.verticalRange × (segment ∩ column).horizontalRange     — when the intersection has positive width
  segment.boundingBox (untouched)                                — when the segment is legitimately shared
                                                                    AND the column does not permit a real
                                                                    physical subdivision (zero/negative-width
                                                                    intersection)
  rowBand.verticalRange × columnBand                             — only for a genuinely empty cell
                                                                    (row_column_empty_slot)
```

A non-shared cell whose segment has no positive-width intersection with its own column is **never** silently approximated — it is a resolution failure (`fragment_no_column_intersection`), reported and excluded from the output.

## 6. Shared geometry

When N ≥ 2 cells resolve to the same `(realPageNumber, segmentKey)`, all N receive `spatialSemantics: "shared"`, the same `sharedGeometryGroupId` (`shared-geometry:<page>:<segmentKey>`), and each other's ids in `sharedWithCellIds` (always symmetric — enforced by the validator). This is not treated as an error: the physical source genuinely offers one area for more than one logical cell, and the future evaluator must never require spatial exclusivity within such a group.

## 7. Empty cells

A cell is empty **only** when `literalText.trim().length === 0`. Only then may `resolutionKind` be `empty_slot_projection`. A non-empty cell with an unresolvable origin is always an integrity error, never silently reinterpreted as empty. An empty cell whose `physicalOriginPt` nonetheless parses as a valid segment declaration is itself an integrity error (`empty_cell_declares_origin`) — contradictory data is surfaced, never guessed away.

## 8. Validation

Two independent layers:

1. **Projection-time** (`discovery-reference-truth-cell-geometry-projection.ts`): a cell that cannot be resolved (missing column/row/region, malformed or unresolvable origin, ambiguous segment key, wrong-page segment, no column intersection without a shared justification) never produces a geometry record — it produces a structured `ReferenceTruthCellGeometryIntegrityIssue` instead.
2. **Post-hoc** (`discovery-reference-truth-cell-geometry-validation.ts`): re-checks, independently, every already-produced geometry for bbox ordering/finiteness, page containment, column/row intersection, envelope-equals-fragment-union, and shared-group symmetry.

No arbitrary decimal tolerance anywhere — every comparison is either exact equality or a strictly-positive-width/height intersection test.

## 9. Independence guarantee

The physical segment registry is never derived from Docling, PaddleOCR, any local-reader evaluation result, any v1/v2 comparison, an LLM, fuzzy matching, or the future deterministic engine. It is produced by re-running the domain's own already-approved, deterministic structural reconstructor against the exact source PDF (verified by SHA-256), executed twice, with byte-for-byte identical output required before publication. See `EPIC_21_EXPECTED_CELL_GEOMETRY_REPORT.md` for the concrete run.
