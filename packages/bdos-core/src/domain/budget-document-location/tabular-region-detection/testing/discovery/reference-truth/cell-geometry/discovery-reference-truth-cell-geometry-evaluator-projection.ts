/**
 * Porta diagnóstica para o futuro avaliador do motor determinístico (§18
 * do enunciado da Sprint). Transforma a geometria já produzida, mais o
 * texto literal já congelado da própria célula, num formato plano
 * consumível pelo comparador — nunca o motor em si, nunca escrito por
 * este módulo. Nunca importa PaddleOCR, Docling, `results/corrected-v2`
 * ou qualquer saída de leitor local.
 */
import type { ReferenceTruthCell } from "../discovery-reference-truth.types";
import type {
  ReferenceTruthBoundingBox,
  ReferenceTruthCellGeometry,
  ReferenceTruthCellGeometryFragment,
  ReferenceTruthCellGeometrySpatialSemantics,
} from "./discovery-reference-truth-cell-geometry.types";

export interface ReferenceTruthExpectedCellForEvaluator {
  readonly cellId: string;
  readonly realPageNumber: number;
  readonly columnId: string;
  readonly literalText: string;
  readonly fragments: ReadonlyArray<ReferenceTruthCellGeometryFragment>;
  readonly expectedEnvelope: ReferenceTruthBoundingBox;
  readonly spatialSemantics: ReferenceTruthCellGeometrySpatialSemantics;
  readonly sharedGeometryGroupId: string | null;
}

/**
 * Une, por `cellId`, a geometria projetada com o texto literal já
 * congelado da célula correspondente. Emite exatamente um registro por
 * célula presente em `geometries` — nunca inventa um registro para uma
 * célula sem geometria resolvida (essas permanecem fora, e são
 * responsabilidade dos testes de integridade de dados reais, nunca desta
 * função).
 */
export function projectReferenceTruthCellsWithGeometry(
  cells: ReadonlyArray<ReferenceTruthCell>,
  geometries: ReadonlyArray<ReferenceTruthCellGeometry>,
): ReadonlyArray<ReferenceTruthExpectedCellForEvaluator> {
  const cellById = new Map(cells.map((c) => [c.id, c] as const));

  return geometries.reduce<ReferenceTruthExpectedCellForEvaluator[]>((acc, geometry) => {
    const cell = cellById.get(geometry.cellId);
    if (cell === undefined) return acc;
    acc.push({
      cellId: geometry.cellId,
      realPageNumber: geometry.realPageNumber,
      columnId: geometry.columnId,
      literalText: cell.literalText,
      fragments: geometry.fragments,
      expectedEnvelope: geometry.expectedEnvelope,
      spatialSemantics: geometry.spatialSemantics,
      sharedGeometryGroupId: geometry.sharedGeometryGroupId,
    });
    return acc;
  }, []);
}
