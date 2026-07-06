# Geospatial Intelligence

Geospatial Intelligence is a BDOS Business Capability focused on spatial business knowledge — see PRINCIPLE 004 (Spatial Intelligence) in `packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md` and `packages/bdos-core/docs/GEOSPATIAL_ENGINE.md`.

A Capability is responsible for supplying business knowledge to the Decision Engine. It does not own the Decision Engine, persistence, user interfaces, APIs, or infrastructure concerns. It does not know CesiumJS, Mapbox, Google Maps, or any map rendering provider — a map is never the interface here, only a possible way the platform later answers a question (see "O Mapa Não É a Interface" in `GEOSPATIAL_ENGINE.md`).

## Architecture

Geospatial Intelligence is organized into three knowledge layers, same as every other BDOS Capability.

## Facts

Facts represent observable spatial business information, produced by `domain/business-facts-generator/adapters/spatial-object` from `domain/spatial-object`.

Documentation examples:

- Spatial Confidence Score
- Spatial Object Status
- Geometry Precision Source
- Distinct Spatial Layers Attached
- Spatial Object Age (time since conception)

## Patterns

Patterns represent business situations detected from Facts.

Documentation examples:

- Low Spatial Confidence
- Spatial Evidence Gap (no evidential layer attached)
- Geometry Never Refined (single, low-precision geometry version)
- Isolated Spatial Object (no relationships to any other object)

## Rules

Rules transform Patterns into Decisions.

Documentation examples:

- If a spatial object's confidence is Low, generate a Low Spatial Confidence Decision.
- If a spatial object has been Active for a long period without an evidential layer, generate a Spatial Evidence Gap Decision (reserved for a future rule — not implemented yet).

Implemented this sprint: `lowSpatialConfidenceRule` (`rules/low-spatial-confidence-rule.ts`).

## Boundaries

Geospatial Intelligence only provides business knowledge. It does not know React, Supabase, databases, APIs, Advisor, UI, Decision Engine internals, or any other Capability. It reads `BusinessFact[]` only — it never reads `SpatialObject` directly (that is the job of `domain/business-facts-generator/adapters/spatial-object`, upstream of this Capability).
