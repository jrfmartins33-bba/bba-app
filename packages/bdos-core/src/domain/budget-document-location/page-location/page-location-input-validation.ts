import { BUDGET_DOCUMENT_SIGNAL_CATALOG } from "../budget-document-signal-catalog";
import type { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";
import type {
  DocumentSignalObservationResult,
  DocumentSignalPageObservation,
  SignalEvaluation,
  SignalObservationEvidenceReference,
} from "../signal-observation/signal-observation.types";
import type { BudgetPageLocationTechnicalProblem } from "./budget-page-location.types";
import {
  SUPPORTED_SOURCE_OBSERVATION_CONTRACTS,
  UNSUPPORTED_SOURCE_SIGNAL_CONTRACTS,
} from "./page-location-decision-rule-registry";
import type {
  PageLocationSourceObservationRuleContract,
  SupportedSourceObservationContract,
} from "./page-location-decision-rule-registry";

export type PageLocationInputValidationResult =
  | {
      readonly kind: "valid";
      readonly contract: SupportedSourceObservationContract;
      readonly problems: ReadonlyArray<BudgetPageLocationTechnicalProblem>;
    }
  | {
      readonly kind: "source_failed" | "version_unsupported" | "invalid";
      readonly contract: SupportedSourceObservationContract | null;
      readonly problems: ReadonlyArray<BudgetPageLocationTechnicalProblem>;
    };

function problem(
  code: BudgetPageLocationTechnicalProblem["code"],
  message: string,
  pageNumber: number | null = null,
  signalId: BudgetDocumentSignalId | null = null,
  ruleId: string | null = null,
): BudgetPageLocationTechnicalProblem {
  return { code, phase: "source_validation", pageNumber, signalId, ruleId, message };
}

function findCompatibleContract(source: DocumentSignalObservationResult): SupportedSourceObservationContract | null {
  return (
    SUPPORTED_SOURCE_OBSERVATION_CONTRACTS.find(
      (contract) =>
        source.schemaVersion === contract.schemaVersion &&
        source.observerName === contract.observerName &&
        source.observerVersion === contract.observerVersion &&
        source.ruleSetVersion === contract.observationRuleSetVersion &&
        source.catalogVersion === contract.catalogVersion,
    ) ?? null
  );
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isValidHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function ruleContractFor(
  contract: SupportedSourceObservationContract,
  signalId: BudgetDocumentSignalId,
): PageLocationSourceObservationRuleContract | null {
  return contract.signalRules.find((entry) => entry.signalId === signalId) ?? null;
}

function validateTextEvidenceReference(reference: SignalObservationEvidenceReference, pageNumber: number): boolean {
  return (
    reference.pageNumber === pageNumber &&
    reference.roleInRule === "primary" &&
    reference.geometry === null &&
    reference.textItems.length > 0 &&
    new Set(reference.textItems.map((item) => item.textItemIndex)).size === reference.textItems.length &&
    reference.textItems.every(
      (item) =>
        Number.isInteger(item.textItemIndex) &&
        item.textItemIndex >= 0 &&
        item.originalText.length > 0 &&
        item.normalizedText !== null &&
        item.normalizedText.length > 0,
    )
  );
}

function validateExtractionEvidenceReference(reference: SignalObservationEvidenceReference, pageNumber: number): boolean {
  return (
    reference.pageNumber === pageNumber &&
    reference.roleInRule === "extraction_availability_field" &&
    reference.geometry === null &&
    reference.textItems.length === 0
  );
}

function isValidGeometryReference(reference: SignalObservationEvidenceReference, sourcePageNumber: number, totalPageCount: number): boolean {
  if (
    reference.geometry === null ||
    reference.textItems.length !== 0 ||
    !isPositiveInteger(reference.pageNumber) ||
    reference.pageNumber > totalPageCount
  ) {
    return false;
  }

  const { widthPoints, heightPoints, orientation } = reference.geometry;
  if (
    widthPoints === null ||
    heightPoints === null ||
    !Number.isFinite(widthPoints) ||
    !Number.isFinite(heightPoints) ||
    widthPoints <= 0 ||
    heightPoints <= 0 ||
    !["portrait", "landscape", "indeterminate"].includes(orientation)
  ) {
    return false;
  }

  if (reference.roleInRule === "reference_page") {
    return reference.pageNumber === sourcePageNumber;
  }
  if (reference.roleInRule === "earlier_page") {
    return reference.pageNumber === sourcePageNumber - 1;
  }
  if (reference.roleInRule === "later_page") {
    return reference.pageNumber === sourcePageNumber + 1;
  }
  return false;
}

function validateObservedEvidence(
  source: DocumentSignalObservationResult,
  pageNumber: number,
  evaluation: SignalEvaluation,
  ruleContract: PageLocationSourceObservationRuleContract,
): boolean {
  const evidence = evaluation.evidence;
  if (
    evidence === null ||
    evidence.sourceByteHash !== source.sourceByteHash ||
    evidence.catalogVersion !== source.catalogVersion ||
    evidence.observerVersion !== source.observerVersion ||
    evidence.signalId !== evaluation.signalId ||
    evidence.ruleId !== ruleContract.ruleId ||
    evidence.ruleVersion !== ruleContract.ruleVersion ||
    evidence.references.length === 0
  ) {
    return false;
  }

  if (evidence.references.some((reference) => reference.pageNumber < 1 || reference.pageNumber > source.totalPageCount)) {
    return false;
  }

  if (ruleContract.evidenceKind === "text") {
    return evidence.references.length === 1 && evidence.references.every((reference) => validateTextEvidenceReference(reference, pageNumber));
  }

  if (ruleContract.evidenceKind === "extraction_field") {
    return evidence.references.length === 1 && validateExtractionEvidenceReference(evidence.references[0], pageNumber);
  }

  const currentReferences = evidence.references.filter((reference) => reference.roleInRule === "reference_page");
  const neighborReferences = evidence.references.filter(
    (reference) => reference.roleInRule === "earlier_page" || reference.roleInRule === "later_page",
  );
  if (
    currentReferences.length !== 1 ||
    neighborReferences.length === 0 ||
    new Set(neighborReferences.map((reference) => reference.pageNumber)).size !== neighborReferences.length ||
    !evidence.references.every((reference) => isValidGeometryReference(reference, pageNumber, source.totalPageCount))
  ) {
    return false;
  }

  const currentGeometry = currentReferences[0].geometry;
  return neighborReferences.every(
    (reference) =>
      reference.geometry?.widthPoints === currentGeometry?.widthPoints &&
      reference.geometry?.heightPoints === currentGeometry?.heightPoints &&
      reference.geometry?.orientation === currentGeometry?.orientation,
  );
}

function validateEvaluationShape(
  source: DocumentSignalObservationResult,
  page: DocumentSignalPageObservation,
  evaluation: SignalEvaluation,
  ruleContract: PageLocationSourceObservationRuleContract,
  problems: BudgetPageLocationTechnicalProblem[],
): void {
  const invalid = (message: string, evidence = false): void => {
    problems.push(
      problem(
        evidence ? "source_observation_evidence_inconsistent" : "source_observation_contract_invalid",
        message,
        page.pageNumber,
        evaluation.signalId,
        evaluation.ruleId,
      ),
    );
  };

  if (
    evaluation.catalogVersion !== source.catalogVersion ||
    evaluation.ruleId !== ruleContract.ruleId ||
    evaluation.ruleVersion !== ruleContract.ruleVersion
  ) {
    invalid("A supported signal evaluation does not match its approved rule contract.");
    return;
  }

  if (evaluation.outcome === "observed") {
    if (evaluation.notEvaluableReasonCode !== null || evaluation.notEvaluableDimension !== null) {
      invalid("An observed signal carries a not-evaluable reason.");
    }
    if (!validateObservedEvidence(source, page.pageNumber, evaluation, ruleContract)) {
      invalid("Positive signal evidence is inconsistent with the approved source contract.", true);
    }
    return;
  }

  if (evaluation.evidence !== null) {
    invalid("Only observed signal evaluations may carry evidence.", true);
  }

  if (evaluation.outcome === "not_observed") {
    if (evaluation.notEvaluableReasonCode !== null || evaluation.notEvaluableDimension !== null) {
      invalid("A not-observed signal carries a not-evaluable reason.");
    }
    return;
  }

  const allowedReasons =
    ruleContract.evidenceKind === "text"
      ? ["page_text_unavailable", "observer_rule_execution_failed"]
      : ruleContract.evidenceKind === "geometry"
        ? ["page_geometry_unavailable", "adjacent_page_unavailable", "observer_rule_execution_failed"]
        : ["observer_rule_execution_failed"];

  if (
    evaluation.notEvaluableReasonCode === null ||
    !allowedReasons.includes(evaluation.notEvaluableReasonCode) ||
    evaluation.notEvaluableDimension !== null
  ) {
    invalid("A supported signal has an incompatible not-evaluable reason.");
  }
}

function validateUnsupportedEvaluation(
  source: DocumentSignalObservationResult,
  page: DocumentSignalPageObservation,
  evaluation: SignalEvaluation,
  problems: BudgetPageLocationTechnicalProblem[],
): void {
  const unsupported = UNSUPPORTED_SOURCE_SIGNAL_CONTRACTS.find((entry) => entry.signalId === evaluation.signalId);
  if (
    unsupported === undefined ||
    evaluation.catalogVersion !== source.catalogVersion ||
    evaluation.outcome !== "not_evaluable" ||
    evaluation.ruleId !== null ||
    evaluation.ruleVersion !== null ||
    evaluation.evidence !== null ||
    evaluation.notEvaluableReasonCode !== unsupported.reasonCode ||
    evaluation.notEvaluableDimension !== unsupported.dimension
  ) {
    problems.push(
      problem(
        "source_observation_contract_invalid",
        "An unsupported signal evaluation does not match its approved contract.",
        page.pageNumber,
        evaluation.signalId,
      ),
    );
  }
}

function validatePageAvailability(
  page: DocumentSignalPageObservation,
  contract: SupportedSourceObservationContract,
  problems: BudgetPageLocationTechnicalProblem[],
): void {
  const evaluations = new Map(page.signalEvaluations.map((evaluation) => [evaluation.signalId, evaluation]));
  const availabilityIds = ["extraction-text-available", "extraction-no-extractable-text", "extraction-error"];
  const availabilityEvaluations = availabilityIds.map((signalId) => evaluations.get(signalId)).filter((value) => value !== undefined);
  const observedAvailabilityCount = availabilityEvaluations.filter((evaluation) => evaluation.outcome === "observed").length;
  const availabilityFailure = availabilityEvaluations.some(
    (evaluation) => evaluation.notEvaluableReasonCode === "observer_rule_execution_failed",
  );

  if ((!availabilityFailure && observedAvailabilityCount !== 1) || observedAvailabilityCount > 1) {
    problems.push(
      problem(
        "source_observation_contract_invalid",
        "Extraction availability signals are not mutually coherent.",
        page.pageNumber,
      ),
    );
    return;
  }

  const textAvailable = evaluations.get("extraction-text-available")?.outcome === "observed";
  const unavailable =
    evaluations.get("extraction-no-extractable-text")?.outcome === "observed" ||
    evaluations.get("extraction-error")?.outcome === "observed";
  const textualContracts = contract.signalRules.filter((entry) => entry.evidenceKind === "text");

  textualContracts.forEach((rule) => {
    const evaluation = evaluations.get(rule.signalId);
    if (evaluation === undefined) {
      return;
    }
    if (textAvailable && evaluation.notEvaluableReasonCode === "page_text_unavailable") {
      problems.push(
        problem(
          "source_observation_contract_invalid",
          "Text is available but a textual signal reports unavailable page text.",
          page.pageNumber,
          evaluation.signalId,
          evaluation.ruleId,
        ),
      );
    }
    if (
      unavailable &&
      evaluation.notEvaluableReasonCode !== "page_text_unavailable" &&
      evaluation.notEvaluableReasonCode !== "observer_rule_execution_failed"
    ) {
      problems.push(
        problem(
          "source_observation_contract_invalid",
          "Text is unavailable but a textual signal does not report that limitation.",
          page.pageNumber,
          evaluation.signalId,
          evaluation.ruleId,
        ),
      );
    }
  });
}

function validateObserverProblemCoherence(
  source: DocumentSignalObservationResult,
  problems: BudgetPageLocationTechnicalProblem[],
): void {
  const expectedFailureKeys = new Set<string>();
  source.pages.forEach((page) => {
    page.signalEvaluations.forEach((evaluation) => {
      if (evaluation.notEvaluableReasonCode === "observer_rule_execution_failed") {
        expectedFailureKeys.add(`${page.pageNumber}:${evaluation.signalId}`);
      }
    });
  });

  const actualFailureKeys = new Set<string>();
  source.technicalProblems.forEach((technicalProblem) => {
    if (
      technicalProblem.code !== "observer_rule_execution_failed" ||
      technicalProblem.pageNumber === null ||
      technicalProblem.signalId === null ||
      technicalProblem.message.trim().length === 0
    ) {
      problems.push(problem("source_observation_contract_invalid", "An observer technical problem is malformed."));
      return;
    }
    actualFailureKeys.add(`${technicalProblem.pageNumber}:${technicalProblem.signalId}`);
  });

  if (
    actualFailureKeys.size !== source.technicalProblems.length ||
    expectedFailureKeys.size !== actualFailureKeys.size ||
    [...expectedFailureKeys].some((key) => !actualFailureKeys.has(key))
  ) {
    problems.push(
      problem(
        "source_observation_contract_invalid",
        "Observer technical problems do not match rule execution failures.",
      ),
    );
  }
}

export function validatePageLocationInput(source: DocumentSignalObservationResult): PageLocationInputValidationResult {
  const contract = findCompatibleContract(source);
  if (contract === null) {
    return {
      kind: "version_unsupported",
      contract: null,
      problems: [
        problem(
          "source_observation_version_unsupported",
          "The source observation contract is not explicitly supported by this locator version.",
        ),
      ],
    };
  }

  if (source.status === "failed") {
    const coherentFailure =
      source.totalPageCount === 0 &&
      source.pages.length === 0 &&
      source.technicalProblems.length === 0 &&
      source.sourceReadMetadata.sourceReadStatus === "failed" &&
      isValidHash(source.sourceByteHash);
    return {
      kind: coherentFailure ? "source_failed" : "invalid",
      contract,
      problems: [
        problem(
          coherentFailure ? "source_observation_failed" : "source_observation_contract_invalid",
          coherentFailure
            ? "The source observation failed before page location could run."
            : "The failed source observation is structurally inconsistent.",
        ),
      ],
    };
  }

  const problems: BudgetPageLocationTechnicalProblem[] = [];
  if (!isValidHash(source.sourceByteHash)) {
    problems.push(problem("source_observation_contract_invalid", "The source byte hash is not a SHA-256 hexadecimal value."));
  }
  if (!isPositiveInteger(source.totalPageCount) || source.pages.length !== source.totalPageCount) {
    problems.push(problem("source_observation_contract_invalid", "Page count does not match a non-empty dense document."));
  }
  if (source.sourceReadMetadata.sourceReadStatus === "failed") {
    problems.push(problem("source_observation_contract_invalid", "A completed observation references a failed source read."));
  }
  if (
    source.sourceReadMetadata.readerName.trim().length === 0 ||
    source.sourceReadMetadata.readerVersion.trim().length === 0 ||
    source.sourceReadMetadata.adapterVersion.trim().length === 0 ||
    (source.sourceReadMetadata.underlyingLibraryVersion !== null &&
      source.sourceReadMetadata.underlyingLibraryVersion.trim().length === 0)
  ) {
    problems.push(problem("source_observation_contract_invalid", "Source read version metadata is incomplete."));
  }
  if (
    (source.status === "completed" && source.technicalProblems.length !== 0) ||
    (source.status === "completed_with_observer_problems" && source.technicalProblems.length === 0)
  ) {
    problems.push(problem("source_observation_contract_invalid", "Observation status and technical problems are inconsistent."));
  }

  const catalogSignalIds = BUDGET_DOCUMENT_SIGNAL_CATALOG.map((definition) => definition.id);
  const seenPageNumbers = new Set<number>();
  source.pages.forEach((page, pageIndex) => {
    const expectedPageNumber = pageIndex + 1;
    if (page.pageNumber !== expectedPageNumber || seenPageNumbers.has(page.pageNumber)) {
      problems.push(
        problem(
          "source_observation_contract_invalid",
          "Pages must be unique, ordered, and dense from 1 through totalPageCount.",
          page.pageNumber,
        ),
      );
    }
    seenPageNumbers.add(page.pageNumber);

    const actualSignalIds = page.signalEvaluations.map((evaluation) => evaluation.signalId);
    if (
      actualSignalIds.length !== catalogSignalIds.length ||
      actualSignalIds.some((signalId, index) => signalId !== catalogSignalIds[index]) ||
      new Set(actualSignalIds).size !== actualSignalIds.length
    ) {
      problems.push(
        problem(
          "source_observation_contract_invalid",
          "A page does not contain every catalog signal exactly once in catalog order.",
          page.pageNumber,
        ),
      );
    }

    page.signalEvaluations.forEach((evaluation) => {
      const ruleContract = ruleContractFor(contract, evaluation.signalId);
      if (ruleContract !== null) {
        validateEvaluationShape(source, page, evaluation, ruleContract, problems);
      } else {
        validateUnsupportedEvaluation(source, page, evaluation, problems);
      }
    });
    validatePageAvailability(page, contract, problems);
  });

  validateObserverProblemCoherence(source, problems);
  return { kind: problems.length === 0 ? "valid" : "invalid", contract, problems };
}
