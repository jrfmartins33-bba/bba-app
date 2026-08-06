/**
 * Algoritmo genérico de projeção da geometria esperada de uma célula da
 * verdade de referência. Puro e determinístico: mesma entrada produz
 * exatamente a mesma saída (nenhum `Date.now`, `Math.random`, iteração
 * sobre `Set`/`Map` sem ordenação estável). Nunca contém página real,
 * hash real, código de item real ou texto do documento — apenas os tipos
 * já congelados da verdade de referência mais o registro de segmentos
 * físicos fornecido pelo chamador.
 */
import type {
  ReferenceTruthCell,
  ReferenceTruthColumn,
  ReferenceTruthLogicalRow,
  ReferenceTruthPhysicalRegion,
} from "../discovery-reference-truth.types";
import { parseReferenceTruthCellPhysicalOrigin } from "./discovery-reference-truth-cell-geometry-origin-parser";
import {
  intersectHorizontal,
  unionBoundingBoxes,
} from "./discovery-reference-truth-cell-geometry-geometry-helpers";
import {
  REFERENCE_TRUTH_CELL_GEOMETRY_SCHEMA_VERSION,
  type ReferenceTruthBoundingBox,
  type ReferenceTruthCellGeometry,
  type ReferenceTruthCellGeometryFragment,
  type ReferenceTruthCellGeometryIntegrityIssue,
  type ReferenceTruthCellGeometryProjectionInput,
  type ReferenceTruthCellGeometryProjectionResult,
  type ReferenceTruthCellGeometryResolutionKind,
  type ReferenceTruthCellGeometrySpatialSemantics,
  type ReferenceTruthPhysicalSegmentGeometry,
} from "./discovery-reference-truth-cell-geometry.types";

function sharedGeometryGroupId(realPageNumber: number, segmentKey: string): string {
  return `shared-geometry:${realPageNumber}:${segmentKey}`;
}

interface ResolvedSegment {
  readonly segmentKey: string;
  readonly boundingBox: ReferenceTruthBoundingBox;
}

function buildSegmentIndex(segments: ReadonlyArray<ReferenceTruthPhysicalSegmentGeometry>): {
  readonly byKey: ReadonlyMap<string, ReferenceTruthPhysicalSegmentGeometry>;
  readonly ambiguousKeys: ReadonlySet<string>;
} {
  const byKey = new Map<string, ReferenceTruthPhysicalSegmentGeometry>();
  const ambiguousKeys = new Set<string>();

  segments.forEach((segment) => {
    const existing = byKey.get(segment.segmentKey);
    if (existing === undefined) {
      byKey.set(segment.segmentKey, segment);
      return;
    }
    if (existing.realPageNumber !== segment.realPageNumber || !boundingBoxEqual(existing.boundingBox, segment.boundingBox)) {
      ambiguousKeys.add(segment.segmentKey);
    }
  });

  return { byKey, ambiguousKeys };
}

function boundingBoxEqual(a: ReferenceTruthBoundingBox, b: ReferenceTruthBoundingBox): boolean {
  return a.leftPoints === b.leftPoints && a.topPoints === b.topPoints && a.rightPoints === b.rightPoints && a.bottomPoints === b.bottomPoints;
}

function resolveRowBand(
  row: ReferenceTruthLogicalRow,
  regionsById: ReadonlyMap<string, ReferenceTruthPhysicalRegion>,
  expectedPage: number,
  cellId: string,
  issues: ReferenceTruthCellGeometryIntegrityIssue[],
): ReferenceTruthBoundingBox | null {
  if (row.physicalRegionIds.length === 0) {
    issues.push({ cellId, code: "row_has_no_physical_regions", message: `logical row "${row.id}" declares no physicalRegionIds` });
    return null;
  }

  const boxes: ReferenceTruthBoundingBox[] = [];
  for (const regionId of row.physicalRegionIds) {
    const region = regionsById.get(regionId);
    if (region === undefined) {
      issues.push({ cellId, code: "row_physical_region_not_found", message: `logical row "${row.id}" references physical region "${regionId}" which does not exist` });
      return null;
    }
    if (region.realPageNumber !== expectedPage) {
      issues.push({ cellId, code: "row_physical_region_wrong_page", message: `physical region "${regionId}" is on page ${region.realPageNumber}, expected page ${expectedPage}` });
      return null;
    }
    boxes.push({
      leftPoints: region.boundingBox.leftPoints,
      topPoints: region.boundingBox.topPoints,
      rightPoints: region.boundingBox.rightPoints,
      bottomPoints: region.boundingBox.bottomPoints,
    });
  }

  return unionBoundingBoxes(boxes);
}

/** Regiões físicas (da mesma página) cujo `segmentKeys` já congelado lista a chave informada — vínculo exclusivamente diagnóstico, nunca escrito de volta em `ReferenceTruthCell.physicalRegionIds`. */
function findOwningRegionIds(
  segmentKey: string,
  page: number,
  regionsByPage: ReadonlyMap<number, ReadonlyArray<ReferenceTruthPhysicalRegion>>,
): ReadonlyArray<string> {
  const regions = regionsByPage.get(page) ?? [];
  return regions.filter((region) => region.segmentKeys.includes(segmentKey)).map((region) => region.id);
}

interface CellResolutionContext {
  readonly cell: ReferenceTruthCell;
  readonly column: ReferenceTruthColumn;
  readonly row: ReferenceTruthLogicalRow;
  readonly rowBand: ReferenceTruthBoundingBox;
  readonly isEmpty: boolean;
  readonly resolvedSegments: ReadonlyArray<ResolvedSegment>;
}

function resolveCellContext(
  cell: ReferenceTruthCell,
  columnsById: ReadonlyMap<string, ReferenceTruthColumn>,
  rowsById: ReadonlyMap<string, ReferenceTruthLogicalRow>,
  regionsById: ReadonlyMap<string, ReferenceTruthPhysicalRegion>,
  segmentIndex: ReturnType<typeof buildSegmentIndex>,
  issues: ReferenceTruthCellGeometryIntegrityIssue[],
): CellResolutionContext | null {
  const column = columnsById.get(cell.columnId);
  if (column === undefined) {
    issues.push({ cellId: cell.id, code: "column_not_found", message: `column "${cell.columnId}" does not exist` });
    return null;
  }

  const row = rowsById.get(cell.logicalRowId);
  if (row === undefined) {
    issues.push({ cellId: cell.id, code: "logical_row_not_found", message: `logical row "${cell.logicalRowId}" does not exist` });
    return null;
  }

  const rowBand = resolveRowBand(row, regionsById, cell.realPageNumber, cell.id, issues);
  if (rowBand === null) return null;

  const isEmpty = cell.literalText.trim().length === 0;
  const parsed = parseReferenceTruthCellPhysicalOrigin(cell.physicalOriginPt);

  if (isEmpty) {
    if (parsed.kind === "ok") {
      issues.push({ cellId: cell.id, code: "empty_cell_declares_origin", message: `cell has empty literalText but physicalOriginPt declares segment key(s): ${parsed.segmentKeys.join(", ")}` });
      return null;
    }
    return { cell, column, row, rowBand, isEmpty: true, resolvedSegments: [] };
  }

  if (parsed.kind === "malformed") {
    issues.push({ cellId: cell.id, code: "origin_malformed", message: parsed.reason });
    return null;
  }

  const resolvedSegments: ResolvedSegment[] = [];
  for (const segmentKey of parsed.segmentKeys) {
    if (segmentIndex.ambiguousKeys.has(segmentKey)) {
      issues.push({ cellId: cell.id, code: "segment_key_ambiguous_in_registry", message: `segment key "${segmentKey}" resolves to more than one distinct geometry in the physical segment registry` });
      return null;
    }
    const segment = segmentIndex.byKey.get(segmentKey);
    if (segment === undefined) {
      issues.push({ cellId: cell.id, code: "segment_not_found", message: `segment key "${segmentKey}" was not found in the physical segment registry` });
      return null;
    }
    if (segment.realPageNumber !== cell.realPageNumber) {
      issues.push({ cellId: cell.id, code: "segment_wrong_page", message: `segment key "${segmentKey}" belongs to page ${segment.realPageNumber}, expected page ${cell.realPageNumber}` });
      return null;
    }
    resolvedSegments.push({ segmentKey, boundingBox: segment.boundingBox });
  }

  return { cell, column, row, rowBand, isEmpty: false, resolvedSegments };
}

/**
 * Projeta a geometria esperada de todas as células fornecidas. Nunca
 * lança para um problema de uma célula individual — cada célula
 * irresolúvel é reportada em `integrityIssues` e simplesmente ausente de
 * `geometries` (nunca presumida, nunca aproximada).
 */
export function projectReferenceTruthCellGeometry(input: ReferenceTruthCellGeometryProjectionInput): ReferenceTruthCellGeometryProjectionResult {
  const columnsById = new Map(input.columns.map((c) => [c.id, c] as const));
  const rowsById = new Map(input.logicalRows.map((r) => [r.id, r] as const));
  const regionsById = new Map(input.physicalRegions.map((r) => [r.id, r] as const));
  const regionsByPage = new Map<number, ReferenceTruthPhysicalRegion[]>();
  input.physicalRegions.forEach((region) => {
    if (!regionsByPage.has(region.realPageNumber)) regionsByPage.set(region.realPageNumber, []);
    regionsByPage.get(region.realPageNumber)!.push(region);
  });

  const segmentIndex = buildSegmentIndex(input.physicalSegments);
  const issues: ReferenceTruthCellGeometryIntegrityIssue[] = [];

  const contexts = new Map<string, CellResolutionContext>();
  input.cells.forEach((cell) => {
    const context = resolveCellContext(cell, columnsById, rowsById, regionsById, segmentIndex, issues);
    if (context !== null) contexts.set(cell.id, context);
  });

  // Mapa global (página, segmentKey) -> células que o referenciam, apenas entre células já resolvidas — necessário para classificar geometria compartilhada (§8/§11 do enunciado).
  const sharingByPageAndSegment = new Map<string, string[]>();
  contexts.forEach((context) => {
    context.resolvedSegments.forEach((segment) => {
      const key = `${context.cell.realPageNumber}:${segment.segmentKey}`;
      if (!sharingByPageAndSegment.has(key)) sharingByPageAndSegment.set(key, []);
      sharingByPageAndSegment.get(key)!.push(context.cell.id);
    });
  });

  const geometries: ReferenceTruthCellGeometry[] = [];

  // Ordem determinística: a ordem de entrada de `input.cells`, nunca a ordem de iteração de um Map/Set.
  input.cells.forEach((cell) => {
    const context = contexts.get(cell.id);
    if (context === undefined) return;

    if (context.isEmpty) {
      const columnBand = { leftPoints: context.column.horizontalIntervalPoints.leftPoints, rightPoints: context.column.horizontalIntervalPoints.rightPoints };
      const projectedBox: ReferenceTruthBoundingBox = {
        leftPoints: columnBand.leftPoints,
        topPoints: context.rowBand.topPoints,
        rightPoints: columnBand.rightPoints,
        bottomPoints: context.rowBand.bottomPoints,
      };
      const fragment: ReferenceTruthCellGeometryFragment = {
        id: `${cell.id}-fragment-1`,
        sourceSegmentKey: null,
        sourceBoundingBox: null,
        projectionKind: "row_column_empty_slot",
        projectedBoundingBox: projectedBox,
      };
      geometries.push({
        schemaVersion: REFERENCE_TRUTH_CELL_GEOMETRY_SCHEMA_VERSION,
        cellId: cell.id,
        realPageNumber: cell.realPageNumber,
        logicalRowId: cell.logicalRowId,
        columnId: cell.columnId,
        resolutionKind: "empty_slot_projection",
        spatialSemantics: "empty_slot",
        sourceSegmentKeys: [],
        sourcePhysicalRegionIds: [],
        rowBand: context.rowBand,
        columnBand,
        fragments: [fragment],
        expectedEnvelope: projectedBox,
        sharedGeometryGroupId: null,
        sharedWithCellIds: [],
        provenance: {
          cellId: cell.id,
          logicalRowId: cell.logicalRowId,
          columnId: cell.columnId,
          columnRole: context.column.role,
          physicalOriginPt: cell.physicalOriginPt,
          parsedSegmentKeys: [],
          rowPhysicalRegionIds: context.row.physicalRegionIds,
          resolutionNotesPt: "Célula fisicamente vazia na verdade de referência (literalText vazio); geometria projetada exclusivamente a partir da faixa da linha e da faixa da coluna, sem nenhum segmento de origem.",
        },
      });
      return;
    }

    const columnBand = { leftPoints: context.column.horizontalIntervalPoints.leftPoints, rightPoints: context.column.horizontalIntervalPoints.rightPoints };
    const fragments: ReferenceTruthCellGeometryFragment[] = [];
    let unresolvable = false;
    const sourcePhysicalRegionIds = new Set<string>();
    let sharedGroupIdForCell: string | null = null;
    const sharedWithCellIdsSet = new Set<string>();

    context.resolvedSegments.forEach((segment, index) => {
      const sharingKey = `${cell.realPageNumber}:${segment.segmentKey}`;
      const sharers = (sharingByPageAndSegment.get(sharingKey) ?? []).filter((id) => id !== cell.id);
      const isShared = sharers.length > 0;

      findOwningRegionIds(segment.segmentKey, cell.realPageNumber, regionsByPage).forEach((id) => sourcePhysicalRegionIds.add(id));

      const intersection = intersectHorizontal(segment.boundingBox, columnBand);

      let projectedBox: ReferenceTruthBoundingBox;
      let projectionKind: ReferenceTruthCellGeometryFragment["projectionKind"];

      if (intersection !== null) {
        projectionKind = "source_segment_column_intersection";
        projectedBox = { leftPoints: intersection.leftPoints, topPoints: segment.boundingBox.topPoints, rightPoints: intersection.rightPoints, bottomPoints: segment.boundingBox.bottomPoints };
      } else if (isShared) {
        projectionKind = "source_segment_exact_box";
        projectedBox = segment.boundingBox;
      } else {
        issues.push({ cellId: cell.id, code: "fragment_no_column_intersection", message: `segment "${segment.segmentKey}" has no horizontal intersection with column "${cell.columnId}" and is not shared with another cell` });
        unresolvable = true;
        return;
      }

      if (isShared) {
        const groupId = sharedGeometryGroupId(cell.realPageNumber, segment.segmentKey);
        if (sharedGroupIdForCell === null) sharedGroupIdForCell = groupId;
        sharers.forEach((id) => sharedWithCellIdsSet.add(id));
      }

      fragments.push({
        id: `${cell.id}-fragment-${index + 1}`,
        sourceSegmentKey: segment.segmentKey,
        sourceBoundingBox: segment.boundingBox,
        projectionKind,
        projectedBoundingBox: projectedBox,
      });
    });

    if (unresolvable || fragments.length === 0) return;

    const envelope = unionBoundingBoxes(fragments.map((f) => f.projectedBoundingBox));
    if (envelope === null) return;

    const isCellShared = sharedGroupIdForCell !== null;
    const resolutionKind: ReferenceTruthCellGeometryResolutionKind =
      context.resolvedSegments.length > 1 ? "multiple_source_fragments" : isCellShared ? "shared_source_geometry" : "single_source_fragment";
    const spatialSemantics: ReferenceTruthCellGeometrySpatialSemantics =
      context.resolvedSegments.length > 1 ? "multi_fragment" : isCellShared ? "shared" : "exclusive";

    geometries.push({
      schemaVersion: REFERENCE_TRUTH_CELL_GEOMETRY_SCHEMA_VERSION,
      cellId: cell.id,
      realPageNumber: cell.realPageNumber,
      logicalRowId: cell.logicalRowId,
      columnId: cell.columnId,
      resolutionKind,
      spatialSemantics,
      sourceSegmentKeys: context.resolvedSegments.map((s) => s.segmentKey),
      sourcePhysicalRegionIds: [...sourcePhysicalRegionIds].sort(),
      rowBand: context.rowBand,
      columnBand,
      fragments,
      expectedEnvelope: envelope,
      sharedGeometryGroupId: sharedGroupIdForCell,
      sharedWithCellIds: [...sharedWithCellIdsSet].sort(),
      provenance: {
        cellId: cell.id,
        logicalRowId: cell.logicalRowId,
        columnId: cell.columnId,
        columnRole: context.column.role,
        physicalOriginPt: cell.physicalOriginPt,
        parsedSegmentKeys: context.resolvedSegments.map((s) => s.segmentKey),
        rowPhysicalRegionIds: context.row.physicalRegionIds,
        resolutionNotesPt: isCellShared
          ? "Origem física compartilhada com outra(s) célula(s) sob o mesmo segmento — ver sharedGeometryGroupId/sharedWithCellIds."
          : "Origem física exclusiva desta célula, resolvida a partir de physicalOriginPt.",
      },
    });
  });

  return { geometries, integrityIssues: issues };
}
