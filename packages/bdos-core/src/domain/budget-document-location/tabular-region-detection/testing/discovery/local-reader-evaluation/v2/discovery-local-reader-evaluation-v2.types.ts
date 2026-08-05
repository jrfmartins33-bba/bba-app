/**
 * Contratos aditivos da correção de métricas (Sprint 21.4B.3A.3, Momento
 * 3C.1). Pré-registrados ANTES de qualquer implementação v2 — ver
 * `packages/bdos-core/docs/EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`.
 *
 * Nunca substitui nenhum tipo de `discovery-local-reader-evaluation.types.ts`
 * (v1, congelado) — apenas adiciona. Nenhum tipo produtivo; exclusivamente
 * diagnóstico, mesmo diretório de teste/descoberta já aprovado.
 */

import type { LocalReaderCellComparisonOutcome } from "../discovery-local-reader-evaluation.types";

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
 * Nota (§6 do pré-registro): `Record` completo das 4 chaves, espelhando o
 * parâmetro real de `classifyLocalReaderMathEvidence` (v1, congelada) —
 * NÃO um tipo parcial. A resolução de "campo não aplicável a esta linha"
 * (ex. `subtotalOrTotal` numa linha `item_de_servico`) fica registrada
 * como pendência explícita no §6 do documento de pré-registro, não
 * decidida por presunção aqui.
 */
export interface LocalReaderMathEvidenceDerivedInputV2 {
  readonly fieldsPresent: Record<LocalReaderMathEvidenceFieldKeyV2, boolean>;
  readonly fieldsDivergentFromSource: ReadonlyArray<LocalReaderMathEvidenceFieldKeyV2>;
}

/** Desfechos de célula que contam como "campo presente" para evidência matemática (§6, passo 4). Nunca ampliado por conveniência. */
export const MATH_EVIDENCE_PRESENT_OUTCOME_V2: LocalReaderCellComparisonOutcome = "direct_match";
/** Desfecho de célula que conta como "campo divergente da fonte" (§6, passo 5). Nunca ampliado por conveniência. */
export const MATH_EVIDENCE_DIVERGENT_OUTCOME_V2: LocalReaderCellComparisonOutcome = "correct_coordinate_wrong_text";

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
