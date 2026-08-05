/**
 * Problema D (Sprint 21.4B.3A.3, Momento 3C.1 → resolvido no Momento
 * 3C.1A → implementação no Momento 3C.2).
 *
 * `deriveMathEvidenceFieldsV2` (abaixo) é o stub original do Momento
 * 3C.1, baseado no `Record<4,boolean>` — @deprecated, ver
 * `LocalReaderMathEvidenceDerivedInputV2`. Mantido apenas como registro
 * histórico, nunca reutilizado pela implementação real.
 *
 * `deriveMathEvidenceFieldStatesV2` e `classifyLocalReaderMathEvidenceV2`
 * (abaixo) são o contrato vinculante resolvido no Momento 3C.1A — ver
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md`
 * §2-§3. `classifyLocalReaderMathEvidence` (v1, `discovery-local-reader-metrics.ts`)
 * permanece absolutamente inalterada nos dois casos.
 *
 * Todos os stubs desta etapa lançam erro explícito até o Momento 3C.2 ser
 * autorizado e implementado.
 */

import type { LocalReaderCellComparisonResult } from "../discovery-local-reader-evaluation.types";
import type { ReferenceTruthMathRelation, ReferenceTruthPageBundle } from "../../reference-truth/discovery-reference-truth.types";
import type { LocalReaderMathEvidenceDerivedInputV2, LocalReaderMathEvidenceFieldStatesV2, LocalReaderMathEvidenceResultV2 } from "./discovery-local-reader-evaluation-v2.types";

/** @deprecated Ver cabeçalho do arquivo e `LocalReaderMathEvidenceDerivedInputV2`. Superado pelo Momento 3C.1A — usar `deriveMathEvidenceFieldStatesV2`. */
export function deriveMathEvidenceFieldsV2(
  _relation: ReferenceTruthMathRelation,
  _cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  _bundle: ReferenceTruthPageBundle,
): LocalReaderMathEvidenceDerivedInputV2 {
  throw new Error(
    "deriveMathEvidenceFieldsV2: not implemented (e superado pelo Momento 3C.1A — usar deriveMathEvidenceFieldStatesV2). Ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md §6.",
  );
}

/** Deriva os 4 estados de campo (adendo §2) a partir de comparações de célula reais — nunca de constantes fixas. */
export function deriveMathEvidenceFieldStatesV2(
  _relation: ReferenceTruthMathRelation,
  _cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  _bundle: ReferenceTruthPageBundle,
): LocalReaderMathEvidenceFieldStatesV2 {
  throw new Error(
    "deriveMathEvidenceFieldStatesV2: not implemented — Momento 3C.2 pendente de autorização (ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md §2).",
  );
}

/** Classificador v2 de evidência matemática (adendo §3) — 4 estados, exclui `not_applicable` do denominador, lança erro de integridade quando nenhum campo é aplicável. */
export function classifyLocalReaderMathEvidenceV2(_mathRelationId: string, _fieldStates: LocalReaderMathEvidenceFieldStatesV2): LocalReaderMathEvidenceResultV2 {
  throw new Error(
    "classifyLocalReaderMathEvidenceV2: not implemented — Momento 3C.2 pendente de autorização (ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md §3).",
  );
}
