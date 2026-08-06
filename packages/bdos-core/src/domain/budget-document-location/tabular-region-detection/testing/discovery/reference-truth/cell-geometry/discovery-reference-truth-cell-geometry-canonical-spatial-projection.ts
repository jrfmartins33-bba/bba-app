/**
 * Projeção canônica exclusivamente espacial — nunca de proveniência ou
 * identidade. Extrai, de qualquer geometria já produzida (schemaVersion 1
 * ou 2: o tipo de entrada é estrutural, não importa `ReferenceTruthCellGeometry`
 * diretamente, propositalmente, para continuar aceitando ambas as formas),
 * exclusivamente os campos espaciais: célula, página, linha, coluna,
 * faixas, fragmentos (caixa física de origem e caixa projetada, nunca a
 * chave), envelope e o conjunto de células que compartilham geometria
 * (nunca o rótulo do grupo, que é derivado e pode mudar com o esquema de
 * identidade sem que a geometria em si mude).
 *
 * Existe para provar, de forma independente do modelo de proveniência,
 * que uma correção de identidade/proveniência nunca altera nenhuma
 * coordenada, faixa, fragmento ou envelope já publicado (ver
 * `EPIC_21_EXPECTED_CELL_GEOMETRY_HISTORICAL_REPLAY_RESULT.md`, §6 do
 * enunciado da correção).
 */
import type { ReferenceTruthBoundingBox, ReferenceTruthHorizontalBand } from "./discovery-reference-truth-cell-geometry.types";

export interface CanonicalSpatialFragment {
  readonly id: string;
  readonly sourceBoundingBox: ReferenceTruthBoundingBox | null;
  readonly projectionKind: string;
  readonly projectedBoundingBox: ReferenceTruthBoundingBox;
}

export interface CanonicalSpatialCellGeometry {
  readonly cellId: string;
  readonly realPageNumber: number;
  readonly logicalRowId: string;
  readonly columnId: string;
  readonly resolutionKind: string;
  readonly spatialSemantics: string;
  readonly rowBand: ReferenceTruthBoundingBox;
  readonly columnBand: ReferenceTruthHorizontalBand;
  readonly fragments: ReadonlyArray<CanonicalSpatialFragment>;
  readonly expectedEnvelope: ReferenceTruthBoundingBox;
  readonly sharedWithCellIds: ReadonlyArray<string>;
}

/** Forma estrutural mínima aceita — deliberadamente mais ampla que qualquer schemaVersion específico, para funcionar sobre dados antigos e novos sem depender do tipo de proveniência. */
export interface CanonicalSpatialProjectionSourceGeometry {
  readonly cellId: string;
  readonly realPageNumber: number;
  readonly logicalRowId: string;
  readonly columnId: string;
  readonly resolutionKind: string;
  readonly spatialSemantics: string;
  readonly rowBand: ReferenceTruthBoundingBox;
  readonly columnBand: ReferenceTruthHorizontalBand;
  readonly fragments: ReadonlyArray<{
    readonly id: string;
    readonly sourceBoundingBox: ReferenceTruthBoundingBox | null;
    readonly projectionKind: string;
    readonly projectedBoundingBox: ReferenceTruthBoundingBox;
  }>;
  readonly expectedEnvelope: ReferenceTruthBoundingBox;
  readonly sharedWithCellIds: ReadonlyArray<string>;
}

/**
 * Determinística: ordena por `cellId` (comparação lexicográfica estável),
 * nunca depende da ordem de entrada nem de nenhum campo de proveniência.
 */
export function buildCanonicalSpatialProjection(
  geometries: ReadonlyArray<CanonicalSpatialProjectionSourceGeometry>,
): ReadonlyArray<CanonicalSpatialCellGeometry> {
  return [...geometries]
    .map((g) => ({
      cellId: g.cellId,
      realPageNumber: g.realPageNumber,
      logicalRowId: g.logicalRowId,
      columnId: g.columnId,
      resolutionKind: g.resolutionKind,
      spatialSemantics: g.spatialSemantics,
      rowBand: g.rowBand,
      columnBand: g.columnBand,
      fragments: g.fragments.map((f) => ({
        id: f.id,
        sourceBoundingBox: f.sourceBoundingBox,
        projectionKind: f.projectionKind,
        projectedBoundingBox: f.projectedBoundingBox,
      })),
      expectedEnvelope: g.expectedEnvelope,
      sharedWithCellIds: [...g.sharedWithCellIds].sort(),
    }))
    .sort((a, b) => a.cellId.localeCompare(b.cellId));
}
