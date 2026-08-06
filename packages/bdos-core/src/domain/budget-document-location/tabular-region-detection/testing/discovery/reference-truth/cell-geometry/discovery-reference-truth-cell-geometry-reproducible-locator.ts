/**
 * Construtor puro e determinístico do localizador estrutural
 * reproduzível — a identidade canônica de um segmento físico a partir do
 * schemaVersion 2 (ver `discovery-reference-truth-cell-geometry.types.ts`
 * e `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`).
 * `reproducibleLineKey`/`reproducibleSegmentKey` são calculadas
 * exclusivamente a partir de fatos estruturais já congelados (posição da
 * região/segmento) e de identidade do reconstrutor físico já verificada
 * como determinística — nunca a partir da `lineKey`/`segmentKey`
 * histórica, que não é reproduzível.
 */
import { createHash } from "node:crypto";
import type { ReferenceTruthBoundingBox, ReproduciblePhysicalSegmentLocator } from "./discovery-reference-truth-cell-geometry.types";

export interface ReproduciblePhysicalSegmentLocatorInput {
  readonly sourceDocumentSha256: string;
  readonly realPageNumber: number;
  readonly frozenPhysicalRegionId: string;
  readonly regionVerticalOrder: number;
  readonly segmentHorizontalOrder: number;
  readonly regionBoundingBox: ReferenceTruthBoundingBox;
  readonly segmentBoundingBox: ReferenceTruthBoundingBox;
  readonly physicalAdapterVersionSha256: string;
  readonly physicalUnderlyingLibraryVersionSha256: string;
  readonly reconstructionContextFingerprint: string;
  readonly physicalGeometryContextFingerprint: string;
}

function canonicalHash(parts: ReadonlyArray<string | number>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function buildReproduciblePhysicalSegmentLocator(input: ReproduciblePhysicalSegmentLocatorInput): ReproduciblePhysicalSegmentLocator {
  const reproducibleLineKey = canonicalHash([
    "reproducible-line",
    input.sourceDocumentSha256,
    input.realPageNumber,
    input.frozenPhysicalRegionId,
    input.regionVerticalOrder,
    input.physicalAdapterVersionSha256,
    input.physicalUnderlyingLibraryVersionSha256,
    input.reconstructionContextFingerprint,
  ]);
  const reproducibleSegmentKey = canonicalHash(["reproducible-segment", reproducibleLineKey, input.segmentHorizontalOrder]);

  return {
    sourceDocumentSha256: input.sourceDocumentSha256,
    realPageNumber: input.realPageNumber,
    frozenPhysicalRegionId: input.frozenPhysicalRegionId,
    regionVerticalOrder: input.regionVerticalOrder,
    segmentHorizontalOrder: input.segmentHorizontalOrder,
    regionBoundingBox: input.regionBoundingBox,
    segmentBoundingBox: input.segmentBoundingBox,
    physicalAdapterVersionSha256: input.physicalAdapterVersionSha256,
    physicalUnderlyingLibraryVersionSha256: input.physicalUnderlyingLibraryVersionSha256,
    reconstructionContextFingerprint: input.reconstructionContextFingerprint,
    physicalGeometryContextFingerprint: input.physicalGeometryContextFingerprint,
    reproducibleLineKey,
    reproducibleSegmentKey,
  };
}
