/**
 * Problema D (Sprint 21.4B.3A.3, Momento 3C.1 → resolvido no Momento
 * 3C.1A → fechado definitivamente no Momento 3C.1B → implementação no
 * Momento 3C.2).
 *
 * `deriveMathEvidenceFieldsV2` (abaixo) é o stub original do Momento
 * 3C.1, baseado no `Record<4,boolean>` — @deprecated, ver
 * `LocalReaderMathEvidenceDerivedInputV2`. Mantido apenas como registro
 * histórico, nunca reutilizado pela implementação real.
 *
 * `deriveMathEvidenceFieldStatesV2` e `classifyLocalReaderMathEvidenceV2`
 * (abaixo) são o contrato vinculante e definitivo, fechado no Momento
 * 3C.1B — ver
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md`
 * §1-§3. `classifyLocalReaderMathEvidence` (v1,
 * `discovery-local-reader-metrics.ts`) permanece absolutamente inalterada
 * em todos os casos.
 *
 * Todos os stubs desta etapa lançam erro explícito até o Momento 3C.2 ser
 * autorizado e implementado.
 */

import type { LocalReaderCellComparisonResult } from "../discovery-local-reader-evaluation.types";
import type { ReferenceTruthMathRelation, ReferenceTruthPageBundle } from "../../reference-truth/discovery-reference-truth.types";
import type { LocalReaderMathEvidenceDerivedInputV2, LocalReaderMathEvidenceFieldStatesV2, LocalReaderMathEvidenceResultV2 } from "./discovery-local-reader-evaluation-v2.types";

/** @deprecated Ver cabeçalho do arquivo e `LocalReaderMathEvidenceDerivedInputV2`. Superado pelo Momento 3C.1A/3C.1B — usar `deriveMathEvidenceFieldStatesV2`. */
export function deriveMathEvidenceFieldsV2(
  _relation: ReferenceTruthMathRelation,
  _cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  _bundle: ReferenceTruthPageBundle,
): LocalReaderMathEvidenceDerivedInputV2 {
  throw new Error(
    "deriveMathEvidenceFieldsV2: not implemented (e superado pelo Momento 3C.1A/3C.1B — usar deriveMathEvidenceFieldStatesV2). Ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md §6.",
  );
}

/**
 * Deriva os 4 estados de campo (Momento 3C.1B §1-§2) a partir da própria
 * `ReferenceTruthMathRelation` (aplicabilidade — `quantityScaled`/
 * `displayedUnitPriceCents`/`displayedTotalCents`/`officialSubtotalOrTotalCents`
 * `!== null`, NUNCA pela existência de célula) e de comparações de célula
 * reais (estado — `MATH_EVIDENCE_OUTCOME_TO_FIELD_STATE_V2`) — nunca de
 * constantes fixas.
 *
 * Deve lançar (nunca acomodar silenciosamente) em três condições, cada
 * uma com um identificador de `LocalReaderMathEvidenceDerivationIntegrityErrorV2`
 * dedicado:
 * - campo aplicável pela relação, mas nenhuma célula esperada correspondente
 *   existe na verdade de referência;
 * - campo não aplicável pela relação, mas uma célula esperada existe
 *   mesmo assim;
 * - uma célula esperada aplicável tem zero, ou mais de um, resultado de
 *   comparação cujo `referenceCellIds` a contém.
 */
export function deriveMathEvidenceFieldStatesV2(
  _relation: ReferenceTruthMathRelation,
  _cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  _bundle: ReferenceTruthPageBundle,
): LocalReaderMathEvidenceFieldStatesV2 {
  throw new Error(
    "deriveMathEvidenceFieldStatesV2: not implemented — Momento 3C.2 pendente de autorização (ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md §1-§2).",
  );
}

/**
 * Classificador v2 de evidência matemática, definitivo (Momento 3C.1B
 * §3) — exclui `not_applicable` do denominador; lança erro de integridade
 * (`integrity_error_no_applicable_field`) quando nenhum campo é
 * aplicável; produz `LocalReaderMathEvidenceResultV2` (5 campos,
 * incluindo `fieldStates`/`missingFieldsPt`/`divergentFieldsPt`).
 */
export function classifyLocalReaderMathEvidenceV2(_mathRelationId: string, _fieldStates: LocalReaderMathEvidenceFieldStatesV2): LocalReaderMathEvidenceResultV2 {
  throw new Error(
    "classifyLocalReaderMathEvidenceV2: not implemented — Momento 3C.2 pendente de autorização (ver EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md §3).",
  );
}
