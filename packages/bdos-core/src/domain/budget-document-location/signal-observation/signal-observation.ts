import { BUDGET_DOCUMENT_SIGNAL_CATALOG } from "../budget-document-signal-catalog";
import { BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION } from "../budget-document-signal-catalog.types";
import type { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";
import type { PhysicalDocumentPage, PhysicalDocumentReadResult } from "../physical-document-read.types";
import { getSignalSupportEntry } from "./signal-observation-support-registry";
import type { SignalSupportEntry } from "./signal-observation-support-registry";
import { getRuleById } from "./signal-observation-rules";
import type { RuleOutcome } from "./signal-observation-rules";
import {
  DOCUMENT_SIGNAL_OBSERVER_NAME,
  DOCUMENT_SIGNAL_OBSERVER_VERSION,
  SIGNAL_OBSERVATION_RULE_SET_VERSION,
  SIGNAL_OBSERVATION_SCHEMA_VERSION,
} from "./signal-observation.types";
import type {
  DocumentSignalObservationResult,
  DocumentSignalObservationSourceMetadata,
  DocumentSignalObservationStatus,
  DocumentSignalObservationTechnicalProblem,
  DocumentSignalPageObservation,
  SignalEvaluation,
} from "./signal-observation.types";

/**
 * Associação determinística dos 23 sinais do catálogo às páginas físicas
 * de um `PhysicalDocumentReadResult` já produzido — nunca recebe bytes,
 * `Uint8Array`, caminho de arquivo ou qualquer objeto de biblioteca de
 * extração.
 *
 * Duas fases genuinamente separadas na estrutura da execução, não apenas
 * descritas em comentário: a primeira fase percorre TODAS as páginas
 * resolvendo somente sinais locais (`evaluationScope: "single_page"`) e
 * sinais sem regra aprovada (que não dependem de nenhuma página); só
 * depois de essa primeira passagem terminar por completo, a segunda fase
 * percorre TODAS as páginas de novo, resolvendo somente sinais
 * dependentes de página física vizinha (`evaluationScope:
 * "adjacent_pages"`), a partir do resultado já calculado pela primeira
 * fase. Uma regra `adjacent_pages` nunca é chamada durante a primeira
 * fase — `evaluateLocalPhase` simplesmente não a resolve, deixando a
 * lacuna para `evaluateAdjacentPhase` preencher.
 */
export function observeDocumentSignals(readResult: PhysicalDocumentReadResult): DocumentSignalObservationResult {
  const sourceReadMetadata: DocumentSignalObservationSourceMetadata = {
    readerName: readResult.readerName,
    readerVersion: readResult.readerVersion,
    adapterVersion: readResult.adapterVersion,
    underlyingLibraryVersion: readResult.underlyingLibraryVersion,
    sourceReadStatus: readResult.status,
  };

  if (readResult.status === "failed") {
    return {
      schemaVersion: SIGNAL_OBSERVATION_SCHEMA_VERSION,
      observerName: DOCUMENT_SIGNAL_OBSERVER_NAME,
      observerVersion: DOCUMENT_SIGNAL_OBSERVER_VERSION,
      ruleSetVersion: SIGNAL_OBSERVATION_RULE_SET_VERSION,
      catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
      sourceByteHash: readResult.sourceByteHash,
      sourceReadMetadata,
      totalPageCount: 0,
      pages: [],
      status: "failed",
      technicalProblems: [],
    };
  }

  const sourceByteHash = readResult.sourceByteHash;
  const technicalProblems: DocumentSignalObservationTechnicalProblem[] = [];

  // --- phase 1: local signals, over every page, fully completed first ---------
  const localMapsByPageIndex = readResult.pages.map((page) => evaluateLocalPhase(page, sourceByteHash, technicalProblems));

  // --- phase 2: adjacent-page signals, over every page, starting only now -----
  const finalMapsByPageIndex = readResult.pages.map((page, pageIndex) => {
    const previous = pageIndex > 0 ? readResult.pages[pageIndex - 1] : null;
    const next = pageIndex < readResult.pages.length - 1 ? readResult.pages[pageIndex + 1] : null;
    return evaluateAdjacentPhase(page, previous, next, localMapsByPageIndex[pageIndex], sourceByteHash, technicalProblems);
  });

  const pages: DocumentSignalPageObservation[] = readResult.pages.map((page, pageIndex) => {
    const finalMap = finalMapsByPageIndex[pageIndex];
    const signalEvaluations: SignalEvaluation[] = BUDGET_DOCUMENT_SIGNAL_CATALOG.map((definition) => {
      const evaluation = finalMap.get(definition.id);
      if (evaluation === undefined) {
        throw new Error(`internal error: no evaluation composed for signal "${definition.id}" on page ${page.pageNumber}`);
      }
      return evaluation;
    });
    return { pageNumber: page.pageNumber, signalEvaluations };
  });

  const status: DocumentSignalObservationStatus = technicalProblems.length > 0 ? "completed_with_observer_problems" : "completed";

  return {
    schemaVersion: SIGNAL_OBSERVATION_SCHEMA_VERSION,
    observerName: DOCUMENT_SIGNAL_OBSERVER_NAME,
    observerVersion: DOCUMENT_SIGNAL_OBSERVER_VERSION,
    ruleSetVersion: SIGNAL_OBSERVATION_RULE_SET_VERSION,
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
    sourceByteHash,
    sourceReadMetadata,
    totalPageCount: readResult.totalPageCount,
    pages,
    status,
    technicalProblems,
  };
}

/**
 * Primeira fase: resolve, para uma única página, todo sinal que não
 * depende de página vizinha — sinais sem nenhuma regra aprovada (cuja
 * resolução não exige executar nada) e sinais com regra `single_page`
 * (executada aqui). Sinais `adjacent_pages` são deliberadamente
 * ignorados nesta função; não aparecem no mapa retornado. Exportada
 * (não pela API pública do pacote, só deste módulo) para permitir prova
 * direta, em teste, de que a fase local nunca resolve um sinal de página
 * vizinha.
 */
export function evaluateLocalPhase(
  page: PhysicalDocumentPage,
  sourceByteHash: string,
  technicalProblems: DocumentSignalObservationTechnicalProblem[],
): Map<BudgetDocumentSignalId, SignalEvaluation> {
  const map = new Map<BudgetDocumentSignalId, SignalEvaluation>();

  BUDGET_DOCUMENT_SIGNAL_CATALOG.forEach((definition) => {
    const supportEntry = getSignalSupportEntry(definition.id);

    if (supportEntry === null || supportEntry.status === "unsupported") {
      map.set(definition.id, buildUnsupportedEvaluation(definition.id, supportEntry));
      return;
    }

    if (supportEntry.evaluationScope !== "single_page") {
      // adjacent_pages: left unresolved here on purpose, filled by evaluateAdjacentPhase.
      return;
    }

    const rule = supportEntry.ruleId === null ? null : getRuleById(supportEntry.ruleId);
    if (rule === null || rule.evaluationScope !== "single_page") {
      map.set(definition.id, buildUnsupportedEvaluation(definition.id, supportEntry));
      return;
    }

    let outcome: RuleOutcome;
    try {
      outcome = rule.evaluate(page);
    } catch {
      technicalProblems.push({
        code: "observer_rule_execution_failed",
        pageNumber: page.pageNumber,
        signalId: definition.id,
        message: "Falha técnica inesperada durante a execução de uma regra de observação.",
      });
      map.set(definition.id, buildRuleExecutionFailureEvaluation(definition.id, rule.ruleId, rule.ruleVersion));
      return;
    }

    map.set(definition.id, buildEvaluationFromOutcome(definition.id, rule.ruleId, rule.ruleVersion, outcome, sourceByteHash));
  });

  return map;
}

/**
 * Segunda fase: parte do mapa já produzido pela primeira fase (copiado,
 * nunca mutado no lugar) e resolve, sobre ele, exatamente os sinais com
 * regra `adjacent_pages` — a única categoria que a primeira fase deixou
 * pendente. `previous`/`next` podem ser `null` na borda do documento; a
 * própria regra decide o que fazer com isso.
 */
export function evaluateAdjacentPhase(
  current: PhysicalDocumentPage,
  previous: PhysicalDocumentPage | null,
  next: PhysicalDocumentPage | null,
  localMap: ReadonlyMap<BudgetDocumentSignalId, SignalEvaluation>,
  sourceByteHash: string,
  technicalProblems: DocumentSignalObservationTechnicalProblem[],
): Map<BudgetDocumentSignalId, SignalEvaluation> {
  const map = new Map(localMap);

  BUDGET_DOCUMENT_SIGNAL_CATALOG.forEach((definition) => {
    const supportEntry = getSignalSupportEntry(definition.id);

    if (supportEntry === null || supportEntry.status !== "supported" || supportEntry.evaluationScope !== "adjacent_pages") {
      return; // already resolved by the local phase
    }

    const rule = supportEntry.ruleId === null ? null : getRuleById(supportEntry.ruleId);
    if (rule === null || rule.evaluationScope !== "adjacent_pages") {
      map.set(definition.id, buildUnsupportedEvaluation(definition.id, supportEntry));
      return;
    }

    let outcome: RuleOutcome;
    try {
      outcome = rule.evaluate(current, previous, next);
    } catch {
      technicalProblems.push({
        code: "observer_rule_execution_failed",
        pageNumber: current.pageNumber,
        signalId: definition.id,
        message: "Falha técnica inesperada durante a execução de uma regra de observação.",
      });
      map.set(definition.id, buildRuleExecutionFailureEvaluation(definition.id, rule.ruleId, rule.ruleVersion));
      return;
    }

    map.set(definition.id, buildEvaluationFromOutcome(definition.id, rule.ruleId, rule.ruleVersion, outcome, sourceByteHash));
  });

  return map;
}

function buildUnsupportedEvaluation(signalId: BudgetDocumentSignalId, supportEntry: SignalSupportEntry | null): SignalEvaluation {
  return {
    signalId,
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
    outcome: "not_evaluable",
    ruleId: null,
    ruleVersion: null,
    evidence: null,
    notEvaluableReasonCode: supportEntry?.unsupportedReasonCode ?? "unsupported_missing_row_reconstruction_capability",
    notEvaluableDimension: supportEntry?.unsupportedDimension ?? null,
  };
}

function buildRuleExecutionFailureEvaluation(signalId: BudgetDocumentSignalId, ruleId: string, ruleVersion: number): SignalEvaluation {
  return {
    signalId,
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
    outcome: "not_evaluable",
    ruleId,
    ruleVersion,
    evidence: null,
    notEvaluableReasonCode: "observer_rule_execution_failed",
    notEvaluableDimension: null,
  };
}

function buildEvaluationFromOutcome(
  signalId: BudgetDocumentSignalId,
  ruleId: string,
  ruleVersion: number,
  outcome: RuleOutcome,
  sourceByteHash: string,
): SignalEvaluation {
  if (outcome.kind === "observed") {
    return {
      signalId,
      catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
      outcome: "observed",
      ruleId,
      ruleVersion,
      evidence: {
        sourceByteHash,
        signalId,
        catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
        ruleId,
        ruleVersion,
        observerVersion: DOCUMENT_SIGNAL_OBSERVER_VERSION,
        references: outcome.references,
      },
      notEvaluableReasonCode: null,
      notEvaluableDimension: null,
    };
  }

  if (outcome.kind === "not_observed") {
    return {
      signalId,
      catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
      outcome: "not_observed",
      ruleId,
      ruleVersion,
      evidence: null,
      notEvaluableReasonCode: null,
      notEvaluableDimension: null,
    };
  }

  return {
    signalId,
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
    outcome: "not_evaluable",
    ruleId,
    ruleVersion,
    evidence: null,
    notEvaluableReasonCode: outcome.reasonCode,
    notEvaluableDimension: null,
  };
}
