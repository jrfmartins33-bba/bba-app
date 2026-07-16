import { BUDGET_DOCUMENT_SIGNAL_CATALOG } from "../budget-document-signal-catalog";
import type { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";
import type {
  SignalNotEvaluableDimension,
  SignalNotEvaluableReasonCode,
  SignalObservationRuleEvaluationScope,
} from "./signal-observation.types";

/**
 * Declara, para cada sinal do catálogo, se esta versão do observador tem
 * capacidade aprovada de avaliá-lo — nunca se uma página específica o
 * satisfaz. Distinto do registro de regras: este registro cobre todos os
 * 23 sinais do catálogo (verificado por teste de integridade); o registro
 * de regras contém somente as regras realmente implementadas e
 * executáveis, que este registro referencia por `ruleId`.
 *
 * A ausência de perfil de qualidade/composição aprovado, ou de capacidade
 * de reconstrução de linha/bloco, é uma condição da capacidade atual do
 * observador — nunca uma observação física sobre a página. Por isso um
 * sinal `unsupported` nunca produz `observed`, mesmo quando sua própria
 * definição descreve uma condição de indeterminação: a ausência de regra
 * aprovada não é, por si só, um fato documental positivo.
 */
export type SignalSupportStatus = "supported" | "unsupported";

export interface SignalSupportEntry {
  readonly signalId: BudgetDocumentSignalId;
  readonly status: SignalSupportStatus;
  /** Presente somente quando `status === "supported"`. */
  readonly evaluationScope: SignalObservationRuleEvaluationScope | null;
  /** Presente somente quando `status === "supported"` — referencia uma entrada real do registro de regras. */
  readonly ruleId: string | null;
  /** Presente somente quando `status === "unsupported"`. */
  readonly unsupportedReasonCode: SignalNotEvaluableReasonCode | null;
  /** Presente somente quando `unsupportedReasonCode === "unsupported_missing_evaluation_profile"`. */
  readonly unsupportedDimension: SignalNotEvaluableDimension | null;
}

export type SignalSupportRegistry = ReadonlyArray<SignalSupportEntry>;

function supported(
  signalId: BudgetDocumentSignalId,
  evaluationScope: SignalObservationRuleEvaluationScope,
  ruleId: string,
): SignalSupportEntry {
  return {
    signalId,
    status: "supported",
    evaluationScope,
    ruleId,
    unsupportedReasonCode: null,
    unsupportedDimension: null,
  };
}

function unsupportedRowReconstruction(signalId: BudgetDocumentSignalId): SignalSupportEntry {
  return {
    signalId,
    status: "unsupported",
    evaluationScope: null,
    ruleId: null,
    unsupportedReasonCode: "unsupported_missing_row_reconstruction_capability",
    unsupportedDimension: null,
  };
}

function unsupportedMissingProfile(
  signalId: BudgetDocumentSignalId,
  dimension: SignalNotEvaluableDimension,
): SignalSupportEntry {
  return {
    signalId,
    status: "unsupported",
    evaluationScope: null,
    ruleId: null,
    unsupportedReasonCode: "unsupported_missing_evaluation_profile",
    unsupportedDimension: dimension,
  };
}

function unsupportedListStructure(signalId: BudgetDocumentSignalId): SignalSupportEntry {
  return {
    signalId,
    status: "unsupported",
    evaluationScope: null,
    ruleId: null,
    unsupportedReasonCode: "unsupported_missing_list_structure_capability",
    unsupportedDimension: null,
  };
}

/**
 * Inventário completo dos 23 sinais do catálogo (Sprint 21.4A.2.b), com
 * classificação de suporte desta versão do observador. Oito sinais são
 * suportados por regra determinística real; quinze permanecem
 * `unsupported` por bloqueio arquitetural documentado — nunca por regra
 * fraca criada apenas para elevar cobertura nominal.
 *
 * `referential-annex-listing` foi deliberadamente marcado `unsupported`
 * (revisão pós-implementação): o catálogo exige uma *listagem* de anexos
 * que nomeia um anexo econômico, não apenas a menção literal da expressão
 * — uma correspondência textual simples também dispararia falsamente na
 * própria página do anexo de preços, que não é uma listagem. Sem uma
 * capacidade de reconhecer estrutura de lista, a regra estaria observando
 * uma versão mais fraca do sinal do que a definida no catálogo.
 */
export const SIGNAL_SUPPORT_REGISTRY: SignalSupportRegistry = [
  // ---- Referential ---------------------------------------------------------
  supported("referential-budget-spreadsheet-mention", "single_page", "referential-budget-spreadsheet-mention-literal-phrase-v1"),
  unsupportedListStructure("referential-annex-listing"),

  // ---- Structural ------------------------------------------------------------
  supported("structural-service-item-identification", "single_page", "structural-service-item-identification-line-start-pattern-v1"),
  unsupportedRowReconstruction("structural-unit-quantity-price-block"),
  unsupportedRowReconstruction("structural-total-value-column"),
  supported("structural-bdi-documentary-mention", "single_page", "structural-bdi-documentary-mention-token-boundary-v2"),
  unsupportedRowReconstruction("structural-tabular-row-repetition"),

  // ---- Continuity --------------------------------------------------------------
  unsupportedRowReconstruction("continuity-repeated-header"),
  supported("continuity-stable-geometry", "adjacent_pages", "continuity-stable-geometry-adjacent-match-v1"),
  unsupportedRowReconstruction("continuity-repeated-row-pattern"),

  // ---- Closure -------------------------------------------------------------------
  supported("closure-general-total-mention", "single_page", "closure-general-total-mention-adjacent-numeric-token-v3"),
  unsupportedRowReconstruction("closure-density-drop"),
  unsupportedRowReconstruction("closure-structural-break"),

  // ---- Extraction condition — availability ------------------------------------------
  supported("extraction-text-available", "single_page", "extraction-text-available-field-v1"),
  supported("extraction-no-extractable-text", "single_page", "extraction-no-extractable-text-field-v1"),
  supported("extraction-error", "single_page", "extraction-error-field-v1"),

  // ---- Extraction condition — quality ------------------------------------------------
  unsupportedMissingProfile("extraction-acceptable-quality", "quality"),
  unsupportedMissingProfile("extraction-degraded-quality", "quality"),
  unsupportedMissingProfile("extraction-indeterminate-quality", "quality"),

  // ---- Extraction condition — composition --------------------------------------------
  unsupportedMissingProfile("extraction-composition-predominantly-textual", "composition"),
  unsupportedMissingProfile("extraction-composition-mixed", "composition"),
  unsupportedMissingProfile("extraction-composition-graphic-or-image", "composition"),
  unsupportedMissingProfile("extraction-composition-not-determinable", "composition"),
];

export function getSignalSupportEntry(signalId: BudgetDocumentSignalId): SignalSupportEntry | null {
  return SIGNAL_SUPPORT_REGISTRY.find((entry) => entry.signalId === signalId) ?? null;
}

/**
 * Confirma que o registro de suporte cobre exatamente os sinais reais do
 * catálogo — nunca uma lista paralela desconectada dele. Usada pelo teste
 * de integridade; não é, por si só, prova de corretude de cada regra.
 */
export function listCatalogSignalIds(): ReadonlyArray<BudgetDocumentSignalId> {
  return BUDGET_DOCUMENT_SIGNAL_CATALOG.map((definition) => definition.id);
}
