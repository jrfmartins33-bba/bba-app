/**
 * Contratos da geometria esperada estruturada das células da verdade de
 * referência (Sprint de geometria, posterior à Sprint 21.4B.3A.3).
 * Camada de diagnóstico ADITIVA — nunca reinterpreta ou substitui
 * `ReferenceTruthCell.physicalRegionIds` (permanece `[]` em todas as
 * 1.019 células, exatamente como já congelado); apenas projeta, a partir
 * de `physicalOriginPt` e de evidência física independente (segmentos
 * horizontais reconstruídos), uma geometria auditável indexada por
 * `cellId`. Nunca importa PaddleOCR, Docling, resultado de motor
 * determinístico ou qualquer resultado v1/v2 — apenas os tipos já
 * congelados de `discovery-reference-truth.types` e uma evidência física
 * de segmentos, resolvida à parte.
 */
import type { ReferenceTruthColumnRole } from "../discovery-reference-truth.types";

export const REFERENCE_TRUTH_CELL_GEOMETRY_SCHEMA_VERSION = 1 as const;

// --- geometria primitiva -----------------------------------------------------

export interface ReferenceTruthBoundingBox {
  readonly leftPoints: number;
  readonly topPoints: number;
  readonly rightPoints: number;
  readonly bottomPoints: number;
}

export interface ReferenceTruthHorizontalBand {
  readonly leftPoints: number;
  readonly rightPoints: number;
}

// --- evidência física independente (nunca derivada do motor ou de leitores) -

/**
 * Um segmento horizontal físico já reconstruído pelo reconstrutor
 * estrutural aprovado do domínio (linhas/segmentos/blocos), identificado
 * por `segmentKey` — a mesma chave referenciada em
 * `ReferenceTruthCell.physicalOriginPt` e em
 * `ReferenceTruthPhysicalRegion.segmentKeys`. Não é recalculada por este
 * módulo: é lida de um registro congelado (ver `physical-segments-page-*`
 * nesta mesma pasta), produzido por uma execução independente e
 * determinística do reconstrutor físico contra o documento exato.
 */
export interface ReferenceTruthPhysicalSegmentGeometry {
  readonly segmentKey: string;
  readonly realPageNumber: number;
  readonly boundingBox: ReferenceTruthBoundingBox;
}

// --- classificação da célula --------------------------------------------------

export type ReferenceTruthCellGeometryResolutionKind =
  | "single_source_fragment"
  | "multiple_source_fragments"
  | "shared_source_geometry"
  | "empty_slot_projection";

export type ReferenceTruthCellGeometrySpatialSemantics = "exclusive" | "shared" | "multi_fragment" | "empty_slot";

export type ReferenceTruthCellGeometryFragmentProjectionKind =
  | "source_segment_column_intersection"
  | "source_segment_exact_box"
  | "row_column_empty_slot";

export interface ReferenceTruthCellGeometryFragment {
  readonly id: string;
  readonly sourceSegmentKey: string | null;
  readonly sourceBoundingBox: ReferenceTruthBoundingBox | null;
  readonly projectionKind: ReferenceTruthCellGeometryFragmentProjectionKind;
  readonly projectedBoundingBox: ReferenceTruthBoundingBox;
}

export interface ReferenceTruthCellGeometryProvenance {
  readonly cellId: string;
  readonly logicalRowId: string;
  readonly columnId: string;
  readonly columnRole: ReferenceTruthColumnRole;
  readonly physicalOriginPt: string;
  readonly parsedSegmentKeys: ReadonlyArray<string>;
  readonly rowPhysicalRegionIds: ReadonlyArray<string>;
  readonly resolutionNotesPt: string;
}

export interface ReferenceTruthCellGeometry {
  readonly schemaVersion: typeof REFERENCE_TRUTH_CELL_GEOMETRY_SCHEMA_VERSION;

  readonly cellId: string;
  readonly realPageNumber: number;
  readonly logicalRowId: string;
  readonly columnId: string;

  readonly resolutionKind: ReferenceTruthCellGeometryResolutionKind;
  readonly spatialSemantics: ReferenceTruthCellGeometrySpatialSemantics;

  readonly sourceSegmentKeys: ReadonlyArray<string>;
  readonly sourcePhysicalRegionIds: ReadonlyArray<string>;

  /** Faixa (caixa) física da linha lógica inteira — evidência/validação independente, nunca a origem da coordenada vertical de uma célula com segmento próprio (ver §7 do enunciado da Sprint). */
  readonly rowBand: ReferenceTruthBoundingBox;
  readonly columnBand: ReferenceTruthHorizontalBand;

  readonly fragments: ReadonlyArray<ReferenceTruthCellGeometryFragment>;
  readonly expectedEnvelope: ReferenceTruthBoundingBox;

  readonly sharedGeometryGroupId: string | null;
  readonly sharedWithCellIds: ReadonlyArray<string>;

  readonly provenance: ReferenceTruthCellGeometryProvenance;
}

// --- entrada do algoritmo genérico -------------------------------------------

export interface ReferenceTruthCellGeometryPageBounds {
  readonly realPageNumber: number;
  readonly pageWidthPoints: number;
  readonly pageHeightPoints: number;
}

/**
 * Entrada pura do projetor: exclusivamente os tipos já congelados da
 * verdade de referência (`discovery-reference-truth.types`) mais o
 * registro de segmentos físicos resolvido à parte. Nunca contém literal
 * de página real, hash real ou topônimo — isso pertence apenas aos
 * arquivos de dados (`*-page-46.ts` etc.), nunca a este contrato.
 */
export interface ReferenceTruthCellGeometryProjectionInput {
  readonly cells: ReadonlyArray<import("../discovery-reference-truth.types").ReferenceTruthCell>;
  readonly logicalRows: ReadonlyArray<import("../discovery-reference-truth.types").ReferenceTruthLogicalRow>;
  readonly physicalRegions: ReadonlyArray<import("../discovery-reference-truth.types").ReferenceTruthPhysicalRegion>;
  readonly columns: ReadonlyArray<import("../discovery-reference-truth.types").ReferenceTruthColumn>;
  readonly physicalSegments: ReadonlyArray<ReferenceTruthPhysicalSegmentGeometry>;
  readonly pageBounds: ReadonlyArray<ReferenceTruthCellGeometryPageBounds>;
}

// --- problemas de integridade (nunca lançados por engano; sempre coletados) --

export type ReferenceTruthCellGeometryIntegrityCode =
  | "column_not_found"
  | "logical_row_not_found"
  | "row_has_no_physical_regions"
  | "row_physical_region_not_found"
  | "row_physical_region_wrong_page"
  | "origin_malformed"
  | "segment_not_found"
  | "segment_wrong_page"
  | "segment_key_ambiguous_in_registry"
  | "empty_cell_declares_origin"
  | "fragment_no_column_intersection"
  | "fragment_outside_page"
  | "fragment_outside_row_band";

export interface ReferenceTruthCellGeometryIntegrityIssue {
  readonly cellId: string;
  readonly code: ReferenceTruthCellGeometryIntegrityCode;
  readonly message: string;
}

export interface ReferenceTruthCellGeometryProjectionResult {
  readonly geometries: ReadonlyArray<ReferenceTruthCellGeometry>;
  readonly integrityIssues: ReadonlyArray<ReferenceTruthCellGeometryIntegrityIssue>;
}
