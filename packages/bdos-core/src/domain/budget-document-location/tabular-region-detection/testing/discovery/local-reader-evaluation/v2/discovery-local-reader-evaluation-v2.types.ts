/**
 * Contratos aditivos da correção de métricas (Sprint 21.4B.3A.3, Momentos
 * 3C.1, 3C.1A e 3C.1B). Pré-registrados ANTES de qualquer implementação
 * v2 — ver `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`,
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md`
 * e `EPIC_21_SPRINT_4B3A3_MOMENTO3C1B_FINAL_V2_CONTRACT_ADDENDUM.md`.
 *
 * Nunca substitui nenhum tipo de `discovery-local-reader-evaluation.types.ts`
 * (v1, congelado) — apenas adiciona. Nenhum tipo produtivo; exclusivamente
 * diagnóstico, mesmo diretório de teste/descoberta já aprovado.
 */

import type { LocalReaderCellComparisonOutcome, LocalReaderMathEvidenceAvailability } from "../discovery-local-reader-evaluation.types";

// --- Problema A (§3 do pré-registro): granularidade das regiões ------------

export interface LocalReaderRegionTextMetricsV2 {
  readonly associationComponents: number;
  readonly expectedRegionsCoveredByAnyComponent: number;
  readonly expectedRegionsWithExactTextualMatch: number;
  readonly expectedRegionsCoveredSpatiallyOnly: number;
  readonly expectedRegionsOmitted: number;
  readonly observedRegionsAdditional: number;
}

// --- Problema B (§4 do pré-registro): associação N:1/1:N com evidência textual

export type LocalReaderRegionComponentOutcomeV2 =
  | "spatial_and_textual_match"
  | "spatial_overlap_without_text_match"
  | "expected_regions_split_across_observed"
  | "multiple_expected_regions_merged"
  | "expected_region_omitted"
  | "observed_region_additional";

export interface LocalReaderRegionComponentResultV2 {
  readonly id: string;
  readonly referenceRegionIds: ReadonlyArray<string>;
  readonly observedRegionIds: ReadonlyArray<string>;
  readonly outcome: LocalReaderRegionComponentOutcomeV2;
}

// --- Problema C (§5 do pré-registro): linhas observadas de descrição multilinha

export interface LocalReaderMultilineObservedInputV2 {
  readonly observedLinesInOrder: ReadonlyArray<string>;
  readonly splitAcrossIncompatibleCells: boolean;
  readonly mergedWithNeighborItemText: string | null;
}

// --- Problema D (§6 do pré-registro): evidência matemática derivada --------

export type LocalReaderMathEvidenceFieldKeyV2 = "quantity" | "unitPrice" | "total" | "subtotalOrTotal";

/**
 * @deprecated Superseded pelo Momento 3C.1A (ver
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1A_MATH_APPLICABILITY_AND_CELL_PROVENANCE_ADDENDUM.md`
 * §1). O `Record<4,boolean>` completo não consegue representar "campo não
 * aplicável a esta linha" sem sobrecarregar `true`/`false` com um segundo
 * significado — as três resoluções possíveis foram avaliadas e todas
 * rejeitadas explicitamente no adendo. Mantido apenas como registro
 * histórico do que foi pré-registrado e depois superado nesta mesma
 * Sprint; NUNCA reutilizado pela implementação real do Momento 3C.2 — usar
 * `LocalReaderMathEvidenceFieldStatesV2` em seu lugar.
 */
export interface LocalReaderMathEvidenceDerivedInputV2 {
  readonly fieldsPresent: Record<LocalReaderMathEvidenceFieldKeyV2, boolean>;
  readonly fieldsDivergentFromSource: ReadonlyArray<LocalReaderMathEvidenceFieldKeyV2>;
}

/** @deprecated Ver `LocalReaderMathEvidenceDerivedInputV2`. Desfecho de célula que contava como "campo presente" sob o modelo booleano superado. */
export const MATH_EVIDENCE_PRESENT_OUTCOME_V2: LocalReaderCellComparisonOutcome = "direct_match";
/** @deprecated Ver `LocalReaderMathEvidenceDerivedInputV2`. Desfecho de célula que contava como "campo divergente" sob o modelo booleano superado. */
export const MATH_EVIDENCE_DIVERGENT_OUTCOME_V2: LocalReaderCellComparisonOutcome = "correct_coordinate_wrong_text";

// --- Problema D, resolvido (Momento 3C.1A): evidência matemática de 4 estados

/**
 * Resolução vinculante da ambiguidade "campo não aplicável" (Momento
 * 3C.1A §1-§2, corrigido e fechado no Momento 3C.1B §1-§3). Substitui,
 * para fins de classificação v2, `LocalReaderMathEvidenceDerivedInputV2`
 * (acima, superado). Mapeamento `LocalReaderCellComparisonOutcome` →
 * estado congelado definitivamente no Momento 3C.1B §2.
 */
export type LocalReaderMathEvidenceFieldStateV2 = "not_applicable" | "present" | "missing" | "divergent";

export interface LocalReaderMathEvidenceFieldStatesV2 {
  readonly quantity: LocalReaderMathEvidenceFieldStateV2;
  readonly unitPrice: LocalReaderMathEvidenceFieldStateV2;
  readonly total: LocalReaderMathEvidenceFieldStateV2;
  readonly subtotalOrTotal: LocalReaderMathEvidenceFieldStateV2;
}

/**
 * Mapeamento completo e definitivo dos 7 `LocalReaderCellComparisonOutcome`
 * (v1, inalterado) que representam o estado de um campo aplicável (Momento
 * 3C.1B §2). `invented_cell` é deliberadamente ausente deste mapa — nunca
 * representa o estado de um campo esperado (ver nota em
 * `INVENTED_CELL_NEVER_REPRESENTS_A_FIELD_STATE_V2` abaixo) e, por desenho
 * do comparador v1 (`classifyComponent`, `referenceCellIds: []` sempre que
 * `outcome === "invented_cell"`), nunca poderia ser encontrado ao procurar
 * o resultado de comparação de uma célula esperada de qualquer forma.
 */
export const MATH_EVIDENCE_OUTCOME_TO_FIELD_STATE_V2: Readonly<Partial<Record<LocalReaderCellComparisonOutcome, LocalReaderMathEvidenceFieldStateV2>>> = {
  direct_match: "present",
  correct_coordinate_wrong_text: "divergent",
  expected_cell_omitted: "missing",
  correct_text_wrong_column: "missing",
  correct_text_no_usable_coordinate: "missing",
  expected_cell_split_into_multiple_observed: "missing",
  multiple_expected_cells_merged: "missing",
} as const;

/** Documental apenas — ver `MATH_EVIDENCE_OUTCOME_TO_FIELD_STATE_V2`. `invented_cell` é avaliado separadamente para `inventedMonetaryValue` (Problema E), nunca aqui. */
export const INVENTED_CELL_NEVER_REPRESENTS_A_FIELD_STATE_V2 = true as const;

/** Distinto de `LocalReaderMathEvidenceAvailability` (v1) — sinaliza o caso "nenhum campo aplicável" (Momento 3C.1A §3, passo 2), que nunca é uma classificação de disponibilidade. */
export type LocalReaderMathEvidenceClassificationIntegrityErrorV2 = "integrity_error_no_applicable_field";

/**
 * Erros de integridade da ETAPA DE DERIVAÇÃO (Momento 3C.1B §1-§2) —
 * distintos de `LocalReaderMathEvidenceClassificationIntegrityErrorV2`
 * (etapa de classificação). Nenhum é acomodado silenciosamente por
 * `deriveMathEvidenceFieldStatesV2`.
 */
export type LocalReaderMathEvidenceDerivationIntegrityErrorV2 =
  | "integrity_error_applicable_field_without_expected_cell"
  | "integrity_error_not_applicable_field_has_expected_cell"
  | "integrity_error_ambiguous_comparison_result_for_expected_cell";

/**
 * Resultado auditável ampliado (Momento 3C.1B §3) — de 3 para 5 campos.
 * `fieldStates` expõe o insumo bruto; `missingFieldsPt`/`divergentFieldsPt`
 * listam exclusivamente campos aplicáveis nesses dois estados —
 * `not_applicable` nunca aparece em nenhuma das duas listas.
 */
export interface LocalReaderMathEvidenceResultV2 {
  readonly mathRelationId: string;
  readonly availability: LocalReaderMathEvidenceAvailability;
  readonly fieldStates: LocalReaderMathEvidenceFieldStatesV2;
  readonly missingFieldsPt: ReadonlyArray<string>;
  readonly divergentFieldsPt: ReadonlyArray<string>;
}

// --- Problema E (§7 do pré-registro): origem dos insumos de viabilidade ----

/**
 * Documenta a proveniência de cada campo de `LocalReaderViabilityGateInputs`
 * (v1, inalterado) — nunca redefine o tipo em si, apenas anota de onde cada
 * valor vem no Momento 3C.2. Puramente documental (usado por teste de
 * pré-registro para impedir que um campo seja esquecido).
 */
export type LocalReaderViabilityInputProvenanceV2 = "already_derived_in_v1" | "corrected_in_v2";

export const VIABILITY_INPUT_PROVENANCE_V2: Readonly<Record<string, LocalReaderViabilityInputProvenanceV2>> = {
  processedAllThreePages: "already_derived_in_v1",
  inventedMonetaryValue: "corrected_in_v2",
  providedPhysicalOriginForCriticalFields: "corrected_in_v2",
  recoveredRequiredFieldsOf80Items: "already_derived_in_v1",
  incorporatedTcuNoteAsItemOrValue: "already_derived_in_v1",
  producedUsableTableCellStructure: "already_derived_in_v1",
  ranOffline: "corrected_in_v2",
  reproducibleConfiguration: "already_derived_in_v1",
  failedOnAnyPage: "already_derived_in_v1",
  requiredNetworkOrExternalService: "corrected_in_v2",
  impedingInstability: "corrected_in_v2",
  providedRelevantTraceableComplementaryEvidence: "corrected_in_v2",
} as const;

export const LOCAL_READER_METRIC_CORRECTION_V2_SCHEMA_VERSION = 1 as const;
