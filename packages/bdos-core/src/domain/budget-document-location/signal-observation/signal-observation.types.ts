import type { BudgetDocumentSignalId, BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION } from "../budget-document-signal-catalog.types";
import type { PhysicalDocumentPageOrientation, PhysicalDocumentReadStatus } from "../physical-document-read.types";

/**
 * Contrato puro da associação determinística entre o catálogo de sinais
 * (Sprint 21.4A.2.b) e as observações físicas do leitor de PDF (Sprint
 * 21.4A.2.c). Responde apenas "quais sinais do catálogo foram
 * objetivamente avaliados nesta página, qual foi o resultado e quais
 * evidências sustentam a observação?" — nunca "esta página pertence ao
 * orçamento?". Não conhece nenhuma biblioteca concreta de extração de PDF
 * nem infraestrutura.
 */

export const SIGNAL_OBSERVATION_SCHEMA_VERSION = 1 as const;

export const DOCUMENT_SIGNAL_OBSERVER_NAME = "document-signal-observer" as const;

export const DOCUMENT_SIGNAL_OBSERVER_VERSION = "document-signal-observer-v1" as const;

/**
 * Versão do conjunto de regras executáveis (registro de regras). Distinta
 * da versão do observador (orquestração) e da versão do catálogo
 * (vocabulário de sinais) — mudar uma regra individual, adicionar ou
 * remover uma regra do registro exige revisão desta versão.
 */
export const SIGNAL_OBSERVATION_RULE_SET_VERSION = "document-signal-observation-rules-v1" as const;

/**
 * Escopo de avaliação de uma regra: local a uma única página, ou
 * dependente de página física vizinha (a única forma de dependência
 * multipágina usada pelo catálogo atual — nenhuma regra desta versão
 * precisa de mais de um vizinho de cada lado).
 */
export type SignalObservationRuleEvaluationScope = "single_page" | "adjacent_pages";

/**
 * Resultado de uma avaliação individual de sinal em uma página.
 *
 * - `observed`: identificado objetivamente por uma regra aprovada.
 * - `not_observed`: a regra foi executada com os dados necessários
 *   disponíveis e a condição não foi encontrada. Não significa página
 *   descartada nem baixa prioridade — apenas que a condição definida pela
 *   regra não ocorreu.
 * - `not_evaluable`: a avaliação não pôde ser executada — por ausência de
 *   capacidade aprovada nesta versão do observador (nenhuma regra
 *   existe), ou por dados insuficientes nesta página/contexto específico
 *   para uma regra que existe.
 */
export type SignalEvaluationOutcome = "observed" | "not_observed" | "not_evaluable";

/**
 * Motivo controlado de `not_evaluable`. As duas primeiras razões refletem
 * a capacidade da versão do observador (nenhuma regra aprovada existe
 * para o sinal, em qualquer página); as demais refletem insuficiência de
 * dados numa página ou contexto específico, para um sinal que tem regra
 * aprovada.
 */
export type SignalNotEvaluableReasonCode =
  | "unsupported_missing_evaluation_profile"
  | "unsupported_missing_row_reconstruction_capability"
  | "page_text_unavailable"
  | "page_geometry_unavailable"
  | "adjacent_page_unavailable"
  | "observer_rule_execution_failed";

/** Dimensão do perfil de avaliação ainda não aprovado, quando aplicável. */
export type SignalNotEvaluableDimension = "quality" | "composition";

/** Recorte de geometria física preservado como evidência auxiliar, apenas quando uma regra objetiva realmente utiliza geometria. */
export interface SignalObservationEvidenceGeometry {
  readonly widthPoints: number | null;
  readonly heightPoints: number | null;
  readonly orientation: PhysicalDocumentPageOrientation;
}

/**
 * Uma referência de evidência a uma única página física. Uma observação
 * de sinal de página única tem exatamente uma referência; uma observação
 * de página vizinha tem duas ou mais, cada uma com seu próprio papel na
 * regra (`roleInRule`).
 */
export interface SignalObservationEvidenceReference {
  readonly pageNumber: number;
  /** Índices estáveis dos itens textuais que sustentam a observação, preservados individualmente — nunca colapsados em um intervalo. */
  readonly textItemIndices: ReadonlyArray<number>;
  /** Trecho original, verbatim, dos itens referenciados. Vazio quando a observação não depende de itens textuais específicos (ex.: campo técnico do leitor). */
  readonly originalSnippet: string;
  /** Trecho normalizado correspondente, apenas quando a regra efetivamente comparou contra texto normalizado. */
  readonly normalizedSnippet: string | null;
  /** Geometria da página referenciada, apenas quando a regra é geométrica. */
  readonly geometry: SignalObservationEvidenceGeometry | null;
  /** Função desta referência dentro da regra (ex.: "primary", "earlier_page", "later_page", "reference_page"). */
  readonly roleInRule: string;
}

/**
 * Evidência de uma observação positiva. Nunca existe para `not_observed`
 * ou `not_evaluable` — evidência é exclusiva de `observed`.
 */
export interface SignalObservationEvidence {
  readonly sourceByteHash: string;
  readonly signalId: BudgetDocumentSignalId;
  readonly catalogVersion: typeof BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly observerVersion: typeof DOCUMENT_SIGNAL_OBSERVER_VERSION;
  readonly references: ReadonlyArray<SignalObservationEvidenceReference>;
}

/**
 * Avaliação de um único sinal do catálogo em uma única página. Toda
 * página produz exatamente uma avaliação por sinal do catálogo — nunca
 * uma lista esparsa que só contenha sinais observados.
 */
export interface SignalEvaluation {
  readonly signalId: BudgetDocumentSignalId;
  readonly catalogVersion: typeof BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION;
  readonly outcome: SignalEvaluationOutcome;
  /** Identidade da regra executada. `null` somente quando `not_evaluable` por ausência de regra aprovada para o sinal. */
  readonly ruleId: string | null;
  readonly ruleVersion: number | null;
  /** Presente somente quando `outcome === "observed"`. */
  readonly evidence: SignalObservationEvidence | null;
  /** Presente somente quando `outcome === "not_evaluable"`. */
  readonly notEvaluableReasonCode: SignalNotEvaluableReasonCode | null;
  /** Presente somente quando `notEvaluableReasonCode === "unsupported_missing_evaluation_profile"`. */
  readonly notEvaluableDimension: SignalNotEvaluableDimension | null;
}

/** Todas as avaliações de sinal de uma página física, na ordem estável do catálogo. */
export interface DocumentSignalPageObservation {
  readonly pageNumber: number;
  readonly signalEvaluations: ReadonlyArray<SignalEvaluation>;
}

/**
 * Status técnico global do processo de associação — nunca representa
 * orçamento encontrado, páginas localizadas, prioridade de página ou
 * sucesso de uma futura classificação.
 *
 * - `completed`: todas as páginas físicas foram avaliadas sem problema
 *   técnico interno do observador (avaliações `not_evaluable` de rotina,
 *   por ausência de capacidade ou de dados, não afetam este status).
 * - `completed_with_observer_problems`: o processo terminou, mas ao menos
 *   uma execução de regra falhou tecnicamente de forma inesperada.
 * - `failed`: a leitura física de origem já havia falhado (`status`
 *   `"failed"` em `PhysicalDocumentReadResult`); nenhuma página existe
 *   para ser avaliada.
 */
export type DocumentSignalObservationStatus = "completed" | "completed_with_observer_problems" | "failed";

export type DocumentSignalObservationTechnicalProblemCode = "observer_rule_execution_failed";

export interface DocumentSignalObservationTechnicalProblem {
  readonly code: DocumentSignalObservationTechnicalProblemCode;
  readonly pageNumber: number | null;
  readonly signalId: BudgetDocumentSignalId | null;
  readonly message: string;
}

/**
 * Metadados técnicos da leitura de origem, preservados por referência —
 * nunca recalculados nem duplicados. `sourceReadStatus` permite ao
 * consumidor entender uma falha de origem cruzando com o próprio
 * `PhysicalDocumentReadResult` pelo mesmo `sourceByteHash`, sem que o
 * observador precise copiar os problemas técnicos do leitor.
 */
export interface DocumentSignalObservationSourceMetadata {
  readonly readerName: string;
  readonly readerVersion: string;
  readonly adapterVersion: string;
  readonly underlyingLibraryVersion: string | null;
  readonly sourceReadStatus: PhysicalDocumentReadStatus;
}

/**
 * Resultado determinístico, versionado e auditável da associação de
 * sinais. Para os mesmos bytes de origem e as mesmas versões de schema,
 * observador, regras e catálogo, o resultado estável deve ser
 * equivalente entre execuções.
 */
export interface DocumentSignalObservationResult {
  readonly schemaVersion: typeof SIGNAL_OBSERVATION_SCHEMA_VERSION;
  readonly observerName: typeof DOCUMENT_SIGNAL_OBSERVER_NAME;
  readonly observerVersion: typeof DOCUMENT_SIGNAL_OBSERVER_VERSION;
  readonly ruleSetVersion: typeof SIGNAL_OBSERVATION_RULE_SET_VERSION;
  readonly catalogVersion: typeof BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION;
  readonly sourceByteHash: string;
  readonly sourceReadMetadata: DocumentSignalObservationSourceMetadata;
  readonly totalPageCount: number;
  readonly pages: ReadonlyArray<DocumentSignalPageObservation>;
  readonly status: DocumentSignalObservationStatus;
  readonly technicalProblems: ReadonlyArray<DocumentSignalObservationTechnicalProblem>;
}
