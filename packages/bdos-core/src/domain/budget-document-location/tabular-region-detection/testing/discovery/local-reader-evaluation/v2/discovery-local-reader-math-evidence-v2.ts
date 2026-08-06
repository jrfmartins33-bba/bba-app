/**
 * Problema D (Sprint 21.4B.3A.3, Momento 3C.1 → resolvido no Momento
 * 3C.1A → fechado definitivamente no Momento 3C.1B → implementado no
 * Momento 3C.2A).
 *
 * `deriveMathEvidenceFieldsV2` (abaixo) é o stub original do Momento
 * 3C.1, baseado no `Record<4,boolean>` — @deprecated, ver
 * `LocalReaderMathEvidenceDerivedInputV2`. Mantido apenas como registro
 * histórico, nunca reutilizado pela implementação real.
 *
 * `deriveMathEvidenceFieldStatesV2` e `classifyLocalReaderMathEvidenceV2`
 * (abaixo) implementam o contrato vinculante e definitivo, fechado no
 * Momento 3C.1B — ver
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md`
 * §1-§3. `classifyLocalReaderMathEvidence` (v1,
 * `discovery-local-reader-metrics.ts`) permanece absolutamente inalterada
 * e NUNCA é chamada por este arquivo para induzir um resultado v2.
 */

import type { LocalReaderCellComparisonResult } from "../discovery-local-reader-evaluation.types";
import type { ReferenceTruthMathRelation, ReferenceTruthPageBundle } from "../../reference-truth/discovery-reference-truth.types";
import {
  MATH_EVIDENCE_OUTCOME_TO_FIELD_STATE_V2,
  type LocalReaderMathEvidenceDerivedInputV2,
  type LocalReaderMathEvidenceFieldKeyV2,
  type LocalReaderMathEvidenceFieldStatesV2,
  type LocalReaderMathEvidenceResultV2,
} from "./discovery-local-reader-evaluation-v2.types";

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
 * Mapeamento campo → coluna esperada, congelado em
 * EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md §6
 * (tabela). `total` e `subtotalOrTotal` compartilham `col-total-cbdi` —
 * mutuamente exclusivos na prática porque `displayedTotalCents` (linhas
 * `item_de_servico`) e `officialSubtotalOrTotalCents` (linhas
 * `grupo`/`subgrupo`/`subtotal`/`total`) nunca são ambos não-nulos na
 * mesma relação real da verdade de referência — não presumido, apenas
 * consequência de nenhuma relação representar mais de um tipo de linha.
 *
 * Consequência descoberta na implementação (Momento 3C.2A, não presumível
 * a partir do texto do 3C.1B sozinho): como os dois campos compartilham
 * `columnId`, a checagem "existe célula esperada para (columnId, linha)"
 * é ambígua quando exatamente um dos dois é aplicável — a célula que
 * legitimamente pertence ao campo aplicável (ex. `total`, numa linha
 * `item_de_servico`) também "existe" para o outro campo, inaplicável
 * (`subtotalOrTotal`), disparando um falso `integrity_error_not_applicable_field_has_expected_cell`.
 * `deriveMathEvidenceFieldStatesV2` (abaixo) resolve isso registrando
 * quais ids de célula já são legitimamente reivindicados por um campo
 * APLICÁVEL antes de avaliar os campos não aplicáveis — uma célula
 * reivindicada por um campo aplicável nunca dispara o erro de
 * integridade para o outro campo que compartilha sua coluna.
 */
const MATH_EVIDENCE_FIELD_COLUMN_ID_V2: Record<LocalReaderMathEvidenceFieldKeyV2, string> = {
  quantity: "col-quantidade",
  unitPrice: "col-unit-cbdi",
  total: "col-total-cbdi",
  subtotalOrTotal: "col-total-cbdi",
};

function isFieldApplicable(relation: ReferenceTruthMathRelation, field: LocalReaderMathEvidenceFieldKeyV2): boolean {
  switch (field) {
    case "quantity":
      return relation.quantityScaled !== null;
    case "unitPrice":
      return relation.displayedUnitPriceCents !== null;
    case "total":
      return relation.displayedTotalCents !== null;
    case "subtotalOrTotal":
      return relation.officialSubtotalOrTotalCents !== null;
  }
}

const MATH_EVIDENCE_FIELD_KEYS_V2: ReadonlyArray<LocalReaderMathEvidenceFieldKeyV2> = ["quantity", "unitPrice", "total", "subtotalOrTotal"];

/**
 * Deriva os 4 estados de campo (Momento 3C.1B §1-§2) a partir da própria
 * `ReferenceTruthMathRelation` (aplicabilidade) e de comparações de
 * célula reais (estado) — nunca de constantes fixas. Lança um dos três
 * erros de integridade congelados quando a relação e a verdade de
 * referência divergem, ou quando a cardinalidade de comparação para uma
 * célula aplicável não é exatamente 1.
 */
export function deriveMathEvidenceFieldStatesV2(
  relation: ReferenceTruthMathRelation,
  cellComparisons: ReadonlyArray<LocalReaderCellComparisonResult>,
  bundle: ReferenceTruthPageBundle,
): LocalReaderMathEvidenceFieldStatesV2 {
  const expectedCellByField = new Map(MATH_EVIDENCE_FIELD_KEYS_V2.map((f) => [f, bundle.cells.find((c) => c.logicalRowId === relation.logicalRowId && c.columnId === MATH_EVIDENCE_FIELD_COLUMN_ID_V2[f])] as const));

  // Ids de célula legitimamente reivindicados por um campo APLICÁVEL —
  // computado antes do laço principal para que campos não aplicáveis que
  // compartilham coluna com um campo aplicável (total/subtotalOrTotal)
  // nunca disparem um falso erro de integridade (ver nota no cabeçalho
  // do arquivo).
  const cellIdsClaimedByApplicableFields = new Set(
    MATH_EVIDENCE_FIELD_KEYS_V2.filter((f) => isFieldApplicable(relation, f))
      .map((f) => expectedCellByField.get(f)?.id)
      .filter((id): id is string => id !== undefined),
  );

  const states: Partial<Record<LocalReaderMathEvidenceFieldKeyV2, LocalReaderMathEvidenceFieldStatesV2[LocalReaderMathEvidenceFieldKeyV2]>> = {};

  for (const field of MATH_EVIDENCE_FIELD_KEYS_V2) {
    const applicable = isFieldApplicable(relation, field);
    const columnId = MATH_EVIDENCE_FIELD_COLUMN_ID_V2[field];
    const expectedCell = expectedCellByField.get(field);

    if (!applicable && expectedCell === undefined) {
      states[field] = "not_applicable";
      continue;
    }
    if (applicable && expectedCell === undefined) {
      throw new Error(
        `deriveMathEvidenceFieldStatesV2: integrity_error_applicable_field_without_expected_cell — relação "${relation.id}", campo "${field}" (coluna "${columnId}", linha "${relation.logicalRowId}") é aplicável pela relação, mas nenhuma célula esperada correspondente existe na verdade de referência.`,
      );
    }
    if (!applicable && expectedCell !== undefined) {
      if (cellIdsClaimedByApplicableFields.has(expectedCell.id)) {
        // Célula compartilhada com outro campo aplicável (mesma coluna,
        // ex. total/subtotalOrTotal) — pertence legitimamente ao outro
        // campo, não é uma violação real.
        states[field] = "not_applicable";
        continue;
      }
      throw new Error(
        `deriveMathEvidenceFieldStatesV2: integrity_error_not_applicable_field_has_expected_cell — relação "${relation.id}", campo "${field}" não é aplicável pela relação, mas a célula esperada "${expectedCell.id}" existe mesmo assim e não pertence a nenhum outro campo aplicável.`,
      );
    }

    // applicable === true && expectedCell !== undefined
    const matches = cellComparisons.filter((c) => c.referenceCellIds.includes(expectedCell!.id));
    if (matches.length !== 1) {
      throw new Error(
        `deriveMathEvidenceFieldStatesV2: integrity_error_ambiguous_comparison_result_for_expected_cell — célula esperada "${expectedCell!.id}" (campo "${field}", relação "${relation.id}") tem ${matches.length} resultado(s) de comparação contendo seu id; exatamente 1 é exigido.`,
      );
    }

    const outcome = matches[0].outcome;
    const state = MATH_EVIDENCE_OUTCOME_TO_FIELD_STATE_V2[outcome];
    if (state === undefined) {
      // Estruturalmente inalcançável para invented_cell (referenceCellIds
      // sempre [] nesse outcome, v1) e para qualquer outcome futuro não
      // mapeado — nunca acomodado silenciosamente.
      throw new Error(
        `deriveMathEvidenceFieldStatesV2: outcome de comparação "${outcome}" não mapeado para nenhum estado v2 (célula "${expectedCell!.id}", campo "${field}", relação "${relation.id}").`,
      );
    }
    states[field] = state;
  }

  return states as LocalReaderMathEvidenceFieldStatesV2;
}

/** Rótulos em português — espelham exatamente MATH_EVIDENCE_FIELD_LABELS_PT (v1, `discovery-local-reader-metrics.ts`, não exportado — cópia auditada, nunca divergente). */
const MATH_EVIDENCE_FIELD_LABELS_PT_V2: Record<LocalReaderMathEvidenceFieldKeyV2, string> = {
  quantity: "quantidade",
  unitPrice: "preço unitário",
  total: "total",
  subtotalOrTotal: "subtotal ou total oficial aplicável",
};

/**
 * Classificador v2 de evidência matemática, definitivo (Momento 3C.1B
 * §3) — exclui `not_applicable` do denominador; lança
 * `integrity_error_no_applicable_field` quando nenhum campo é aplicável;
 * produz `LocalReaderMathEvidenceResultV2` (5 campos). NUNCA chama
 * `classifyLocalReaderMathEvidence` (v1) para induzir o resultado.
 */
export function classifyLocalReaderMathEvidenceV2(mathRelationId: string, fieldStates: LocalReaderMathEvidenceFieldStatesV2): LocalReaderMathEvidenceResultV2 {
  const applicableFields = MATH_EVIDENCE_FIELD_KEYS_V2.filter((f) => fieldStates[f] !== "not_applicable");

  if (applicableFields.length === 0) {
    throw new Error(`classifyLocalReaderMathEvidenceV2: integrity_error_no_applicable_field — relação "${mathRelationId}" não tem nenhum campo aplicável.`);
  }

  const missingFieldsPt = applicableFields.filter((f) => fieldStates[f] === "missing").map((f) => MATH_EVIDENCE_FIELD_LABELS_PT_V2[f]);
  const divergentFieldsPt = applicableFields.filter((f) => fieldStates[f] === "divergent").map((f) => MATH_EVIDENCE_FIELD_LABELS_PT_V2[f]);

  let availability: LocalReaderMathEvidenceResultV2["availability"];
  if (divergentFieldsPt.length > 0) {
    availability = "evidencia_divergente_da_fonte";
  } else if (applicableFields.every((f) => fieldStates[f] === "present")) {
    availability = "evidencia_completa";
  } else if (applicableFields.every((f) => fieldStates[f] === "missing")) {
    availability = "evidencia_ausente";
  } else {
    availability = "evidencia_parcial";
  }

  return { mathRelationId, availability, fieldStates, missingFieldsPt, divergentFieldsPt };
}
