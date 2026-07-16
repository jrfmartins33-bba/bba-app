import { BUDGET_DOCUMENT_SIGNAL_CATALOG } from "../budget-document-signal-catalog";
import { BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION } from "../budget-document-signal-catalog.types";
import type { PhysicalDocumentPage, PhysicalDocumentReadResult } from "../physical-document-read.types";
import { getSignalSupportEntry } from "./signal-observation-support-registry";
import { getRuleById } from "./signal-observation-rules";
import type { RuleOutcome, SignalObservationRule } from "./signal-observation-rules";
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
 * extração. Duas passagens explícitas: a primeira avalia sinais locais a
 * cada página; a segunda avalia sinais dependentes de página física
 * vizinha, usando os resultados já calculados na primeira apenas como
 * ponto de partida de iteração, nunca como entrada das regras locais.
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

  const technicalProblems: DocumentSignalObservationTechnicalProblem[] = [];

  const pages: DocumentSignalPageObservation[] = readResult.pages.map((page, pageIndex) => {
    const previous = pageIndex > 0 ? readResult.pages[pageIndex - 1] : null;
    const next = pageIndex < readResult.pages.length - 1 ? readResult.pages[pageIndex + 1] : null;

    const signalEvaluations: SignalEvaluation[] = BUDGET_DOCUMENT_SIGNAL_CATALOG.map((definition) =>
      evaluateOneSignal(page, previous, next, definition.id, readResult.sourceByteHash, technicalProblems),
    );

    return { pageNumber: page.pageNumber, signalEvaluations };
  });

  const status: DocumentSignalObservationStatus = technicalProblems.length > 0 ? "completed_with_observer_problems" : "completed";

  return {
    schemaVersion: SIGNAL_OBSERVATION_SCHEMA_VERSION,
    observerName: DOCUMENT_SIGNAL_OBSERVER_NAME,
    observerVersion: DOCUMENT_SIGNAL_OBSERVER_VERSION,
    ruleSetVersion: SIGNAL_OBSERVATION_RULE_SET_VERSION,
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
    sourceByteHash: readResult.sourceByteHash,
    sourceReadMetadata,
    totalPageCount: readResult.totalPageCount,
    pages,
    status,
    technicalProblems,
  };
}

function evaluateOneSignal(
  page: PhysicalDocumentPage,
  previous: PhysicalDocumentPage | null,
  next: PhysicalDocumentPage | null,
  signalId: string,
  sourceByteHash: string,
  technicalProblems: DocumentSignalObservationTechnicalProblem[],
): SignalEvaluation {
  const supportEntry = getSignalSupportEntry(signalId);

  if (supportEntry === null || supportEntry.status === "unsupported") {
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

  const rule = supportEntry.ruleId === null ? null : getRuleById(supportEntry.ruleId);

  if (rule === null) {
    return {
      signalId,
      catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
      outcome: "not_evaluable",
      ruleId: null,
      ruleVersion: null,
      evidence: null,
      notEvaluableReasonCode: "unsupported_missing_row_reconstruction_capability",
      notEvaluableDimension: null,
    };
  }

  let outcome: RuleOutcome;
  try {
    outcome = runRule(rule, page, previous, next);
  } catch {
    technicalProblems.push({
      code: "observer_rule_execution_failed",
      pageNumber: page.pageNumber,
      signalId,
      message: "Falha técnica inesperada durante a execução de uma regra de observação.",
    });
    return {
      signalId,
      catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
      outcome: "not_evaluable",
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      evidence: null,
      notEvaluableReasonCode: "observer_rule_execution_failed",
      notEvaluableDimension: null,
    };
  }

  if (outcome.kind === "observed") {
    return {
      signalId,
      catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
      outcome: "observed",
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      evidence: {
        sourceByteHash,
        signalId,
        catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
        ruleId: rule.ruleId,
        ruleVersion: rule.ruleVersion,
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
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      evidence: null,
      notEvaluableReasonCode: null,
      notEvaluableDimension: null,
    };
  }

  return {
    signalId,
    catalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
    outcome: "not_evaluable",
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    evidence: null,
    notEvaluableReasonCode: outcome.reasonCode,
    notEvaluableDimension: null,
  };
}

function runRule(
  rule: SignalObservationRule,
  page: PhysicalDocumentPage,
  previous: PhysicalDocumentPage | null,
  next: PhysicalDocumentPage | null,
): RuleOutcome {
  if (rule.evaluationScope === "single_page") {
    return rule.evaluate(page);
  }
  return rule.evaluate(page, previous, next);
}
