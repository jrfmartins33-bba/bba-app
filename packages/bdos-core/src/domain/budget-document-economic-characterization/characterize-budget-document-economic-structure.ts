import type {
  NeutralDocumentGroup,
  NeutralDocumentPage,
  NeutralDocumentRegion,
} from "../budget-document-location/page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { PageBoundaryNeutralContinuityEvaluation } from "../budget-document-location/page-boundary-neutral-continuity-evaluation/budget-document-page-boundary-neutral-continuity-evaluation.types";
import type {
  BudgetDocumentEconomicCharacterizationInput,
  BudgetDocumentEconomicCharacterizationResult,
  ColumnRoleAssignment,
  EconomicCharacterizationGlobalStatus,
  EconomicCharacterizationTechnicalProblem,
  IndependentBudgetReferenceLine,
  ParentResolutionMethod,
  ProposedBudgetLine,
  ProposedLineExtractionStatus,
  ProposedLineType,
} from "./budget-document-economic-characterization.types";
import {
  BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_NAME,
  BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_VERSION,
  BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_SCHEMA_VERSION,
  COLUMN_ROLE_RECOGNITION_RULE_ID, COLUMN_ROLE_RECOGNITION_RULE_VERSION,
  BRAZILIAN_NUMBER_PARSING_RULE_ID, BRAZILIAN_NUMBER_PARSING_RULE_VERSION,
  ECONOMIC_CHARACTERIZATION_CANONICAL_SERIALIZATION_VERSION,
  ECONOMIC_CHARACTERIZATION_IDENTITY_FINGERPRINT_VERSION,
  ECONOMIC_CHARACTERIZATION_RESULT_FINGERPRINT_VERSION,
  RECONCILIATION_RULE_ID, RECONCILIATION_RULE_VERSION,
  ROW_CLASSIFICATION_RULE_ID, ROW_CLASSIFICATION_RULE_VERSION,
} from "./budget-document-economic-characterization.types";
import { validateEconomicCharacterizationInput } from "./budget-document-economic-characterization-input-validation";
import { recognizeColumnRoles } from "./budget-document-economic-characterization-column-labels";
import { classifyRow, extractCellValuesByRole, parseHierarchicalCode } from "./budget-document-economic-characterization-row-classification";
import type { HierarchicalCodeParse } from "./budget-document-economic-characterization-row-classification";
import {
  advanceContextAfterGroup, advanceContextAfterSubgroup, EMPTY_HIERARCHY_CONTEXT,
  resolveGroupParent, resolveServiceItemParentByCode, resolveServiceItemParentByPosition, resolveSubgroupParent,
} from "./budget-document-economic-characterization-hierarchy";
import type { HierarchyContext } from "./budget-document-economic-characterization-hierarchy";
import { computeProposedLineId } from "./budget-document-economic-characterization-keys";
import { parseBrazilianMoney, parseBrazilianQuantity } from "./budget-document-economic-characterization-number-parsing";
import { problem } from "./budget-document-economic-characterization-technical-problem";
import { PROFILE, LIMITATIONS } from "./budget-document-economic-characterization-profile";
import { computeIdentityFingerprint, computeResultFingerprint } from "./budget-document-economic-characterization-fingerprint";
import { computeMetrics, sumServiceItemTotals } from "./budget-document-economic-characterization-metrics";
import { buildIndependentReferenceDiff, buildSelfConsistencyDiagnostic, reconcileLine } from "./budget-document-economic-characterization-reconciliation";

function boundarySustained(evaluations: ReadonlyArray<PageBoundaryNeutralContinuityEvaluation>, originRegionKey: string, targetRegionKey: string): boolean {
  return evaluations.some((evaluation) => evaluation.originRegionKey === originRegionKey && evaluation.targetRegionKey === targetRegionKey && evaluation.status === "continuity_sustained");
}

function determineExtractionStatus(
  type: ProposedLineType,
  parentOutcome: "resolved" | "orphan" | "not_applicable",
  descriptionPresent: boolean,
  quantityStatus: "parsed" | "unparseable" | "absent",
  unitPriceStatus: "parsed" | "unparseable" | "absent",
  totalStatus: "parsed" | "unparseable" | "absent",
): ProposedLineExtractionStatus {
  if (type === "not_processable") return "technical_failure";
  if (type === "ambiguous") return "requires_review";
  if (type === "header" || type === "repeated_header" || type === "note" || type === "empty" || type === "subtotal_or_total") return "extracted";

  if (parentOutcome === "orphan") return "requires_review";

  if (type === "group" || type === "subgroup") return descriptionPresent ? "extracted" : "extracted_with_warnings";

  // service_item
  if (!descriptionPresent) return "requires_review";
  const statuses = [quantityStatus, unitPriceStatus, totalStatus];
  if (statuses.every((s) => s === "parsed")) return "extracted";
  if (statuses.some((s) => s === "unparseable")) return "extracted_with_warnings";
  return "incomplete";
}

interface WalkState {
  hierarchyContext: HierarchyContext;
  documentaryOrder: number;
  lastRoleAssignments: ReadonlyMap<number, ColumnRoleAssignment> | null;
  lastRegionKey: string | null;
  seenHeaderSignatures: Set<string>;
}

function processRegion(
  group: NeutralDocumentGroup,
  page: NeutralDocumentPage,
  region: NeutralDocumentRegion,
  continuityEvaluations: ReadonlyArray<PageBoundaryNeutralContinuityEvaluation>,
  state: WalkState,
  proposedLines: ProposedBudgetLine[],
  technicalProblems: EconomicCharacterizationTechnicalProblem[],
): void {
  const recognition = recognizeColumnRoles(region);
  let roleByColumnOrder: Map<number, ColumnRoleAssignment>;

  if (recognition.status === "recognized") {
    roleByColumnOrder = new Map(recognition.assignments.map((a) => [a.columnOrder, a]));
    state.lastRoleAssignments = roleByColumnOrder;
  } else {
    if (recognition.status === "ambiguous_role_conflict") {
      technicalProblems.push(problem("column_role_conflict_unresolved", "column_recognition", {
        sourceCandidateGroupKey: group.sourceCandidateGroupKey, pageNumber: page.pageNumber, sourceRegionKey: region.sourceRegionKey,
      }));
    }
    const canReuse = state.lastRoleAssignments !== null && state.lastRegionKey !== null && boundarySustained(continuityEvaluations, state.lastRegionKey, region.sourceRegionKey);
    roleByColumnOrder = canReuse ? new Map(state.lastRoleAssignments!) : new Map();
  }

  state.lastRegionKey = region.sourceRegionKey;

  for (const line of region.documentLines) {
    const cellValues = extractCellValuesByRole(line, roleByColumnOrder);
    const classification = classifyRow(line, cellValues, state.seenHeaderSignatures);

    const proposedLineId = computeProposedLineId(group.sourceCandidateGroupKey, page.pageNumber, region.sourceRegionKey, line.sourceLineKey);
    const documentaryOrder = state.documentaryOrder;
    state.documentaryOrder += 1;

    let parentProposedLineId: string | null = null;
    let parentResolutionMethod: ParentResolutionMethod = "NotApplicable";
    let parentOutcome: "resolved" | "orphan" | "not_applicable" = "not_applicable";
    let hierarchicalCode: HierarchicalCodeParse | null = classification.hierarchicalCode;

    if (classification.type === "group") {
      const resolution = resolveGroupParent();
      parentProposedLineId = resolution.parentProposedLineId;
      parentResolutionMethod = resolution.method;
      parentOutcome = "resolved";
      state.hierarchyContext = advanceContextAfterGroup(proposedLineId, hierarchicalCode!);
    } else if (classification.type === "subgroup") {
      const resolution = resolveSubgroupParent(state.hierarchyContext, hierarchicalCode!);
      if (resolution.outcome === "resolved") {
        parentProposedLineId = resolution.parentProposedLineId;
        parentResolutionMethod = resolution.method;
        parentOutcome = "resolved";
        state.hierarchyContext = advanceContextAfterSubgroup(state.hierarchyContext, proposedLineId, hierarchicalCode!);
      } else {
        parentOutcome = "orphan";
        technicalProblems.push(problem("hierarchical_code_orphan", "hierarchy_construction", {
          sourceCandidateGroupKey: group.sourceCandidateGroupKey, pageNumber: page.pageNumber, sourceRegionKey: region.sourceRegionKey, sourceLineKey: line.sourceLineKey, proposedLineId,
        }));
      }
    } else if (classification.type === "service_item") {
      const resolution = hierarchicalCode !== null
        ? resolveServiceItemParentByCode(state.hierarchyContext, hierarchicalCode)
        : resolveServiceItemParentByPosition(state.hierarchyContext);
      if (resolution.outcome === "resolved") {
        parentProposedLineId = resolution.parentProposedLineId;
        parentResolutionMethod = resolution.method;
        parentOutcome = "resolved";
      } else {
        parentOutcome = "orphan";
        technicalProblems.push(problem("hierarchical_code_orphan", "hierarchy_construction", {
          sourceCandidateGroupKey: group.sourceCandidateGroupKey, pageNumber: page.pageNumber, sourceRegionKey: region.sourceRegionKey, sourceLineKey: line.sourceLineKey, proposedLineId,
        }));
      }
    }

    const quantity = classification.type === "service_item" ? parseBrazilianQuantity(cellValues.quantity) : { originalText: null, exactDecimalText: null, decimalPlaces: null, status: "absent" as const };
    const unitPrice = classification.type === "service_item" ? parseBrazilianMoney(cellValues.unitPrice) : { originalText: null, cents: null, status: "absent" as const };
    const total = (classification.type === "service_item" || classification.type === "group") ? parseBrazilianMoney(cellValues.total) : { originalText: null, cents: null, status: "absent" as const };

    const externalCode = classification.type === "group" || classification.type === "subgroup" || classification.type === "service_item" ? cellValues.externalCode : null;

    const extractionStatus = determineExtractionStatus(
      classification.type, parentOutcome, cellValues.description !== null,
      quantity.status, unitPrice.status, total.status,
    );

    proposedLines.push({
      proposedLineId,
      documentaryOrder,
      type: classification.type,
      parentProposedLineId,
      parentResolutionMethod,
      externalCode,
      descriptionOriginal: cellValues.description,
      unitOriginal: classification.type === "service_item" ? cellValues.unit : null,
      quantity,
      unitPrice,
      total,
      extractionStatus,
      technicalProblems: [],
      provenance: {
        sourceCandidateGroupKey: group.sourceCandidateGroupKey,
        pageNumber: page.pageNumber,
        sourceRegionKey: region.sourceRegionKey,
        sourceLineKey: line.sourceLineKey,
        sourceLine: line,
      },
    });
  }
}

function buildFailedResult(
  input: BudgetDocumentEconomicCharacterizationInput,
  identityFingerprint: string,
  technicalProblems: ReadonlyArray<EconomicCharacterizationTechnicalProblem>,
): BudgetDocumentEconomicCharacterizationResult {
  return buildResult(input, identityFingerprint, [], technicalProblems, "failed", null, null);
}

function buildResult(
  input: BudgetDocumentEconomicCharacterizationInput,
  identityFingerprint: string,
  proposedLines: ReadonlyArray<ProposedBudgetLine>,
  technicalProblems: ReadonlyArray<EconomicCharacterizationTechnicalProblem>,
  status: EconomicCharacterizationGlobalStatus,
  referenceLines: ReadonlyArray<IndependentBudgetReferenceLine> | null,
  referenceSourceDescription: string | null,
): BudgetDocumentEconomicCharacterizationResult {
  const g2 = input.pageLocalNeutralStructuredEvidence;
  const g3 = input.pageBoundaryNeutralContinuity;

  const declaredTotalCents = sumServiceItemTotals(proposedLines);
  const recalculatedTotalCents = declaredTotalCents;
  const lineReconciliations = proposedLines
    .filter((line) => line.type === "service_item")
    .map((line) => reconcileLine(line));

  const totalPhysicalLines = g2.groups.flatMap((group) => group.pages).flatMap((page) => page.regions).flatMap((region) => region.documentLines).length;
  const independentReferenceDiff = buildIndependentReferenceDiff(proposedLines, referenceLines, referenceSourceDescription);
  const selfConsistencyDiagnostic = buildSelfConsistencyDiagnostic(proposedLines, totalPhysicalLines);

  const metrics = computeMetrics(proposedLines, declaredTotalCents, recalculatedTotalCents, technicalProblems);
  const content = { status, proposedLines, lineReconciliations, independentReferenceDiff, selfConsistencyDiagnostic, technicalProblems, metrics, limitations: LIMITATIONS };

  return {
    schemaVersion: BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_SCHEMA_VERSION,
    engineName: BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_NAME,
    engineVersion: BUDGET_DOCUMENT_ECONOMIC_CHARACTERIZATION_ENGINE_VERSION,
    columnRoleRecognitionRuleId: COLUMN_ROLE_RECOGNITION_RULE_ID, columnRoleRecognitionRuleVersion: COLUMN_ROLE_RECOGNITION_RULE_VERSION,
    rowClassificationRuleId: ROW_CLASSIFICATION_RULE_ID, rowClassificationRuleVersion: ROW_CLASSIFICATION_RULE_VERSION,
    numberParsingRuleId: BRAZILIAN_NUMBER_PARSING_RULE_ID, numberParsingRuleVersion: BRAZILIAN_NUMBER_PARSING_RULE_VERSION,
    reconciliationRuleId: RECONCILIATION_RULE_ID, reconciliationRuleVersion: RECONCILIATION_RULE_VERSION,
    canonicalSerializationVersion: ECONOMIC_CHARACTERIZATION_CANONICAL_SERIALIZATION_VERSION,
    identityFingerprintVersion: ECONOMIC_CHARACTERIZATION_IDENTITY_FINGERPRINT_VERSION,
    identityFingerprint,
    resultFingerprintVersion: ECONOMIC_CHARACTERIZATION_RESULT_FINGERPRINT_VERSION,
    resultFingerprint: computeResultFingerprint(identityFingerprint, content),
    sourceByteHash: g2.sourceByteHash,
    sourcePageLocalNeutralStructuredEvidenceIdentityFingerprint: g2.identityFingerprint,
    sourcePageLocalNeutralStructuredEvidenceResultFingerprint: g2.resultFingerprint,
    sourcePageLocalNeutralStructuredEvidenceStatus: g2.status,
    sourcePageBoundaryNeutralContinuityIdentityFingerprint: g3.identityFingerprint,
    sourcePageBoundaryNeutralContinuityResultFingerprint: g3.resultFingerprint,
    sourcePageBoundaryNeutralContinuityStatus: g3.status,
    status, proposedLines, lineReconciliations, independentReferenceDiff, selfConsistencyDiagnostic,
    technicalProblems, metrics, limitations: LIMITATIONS,
  };
}

export function characterizeBudgetDocumentEconomicStructure(
  input: BudgetDocumentEconomicCharacterizationInput,
  options: { readonly referenceLines?: ReadonlyArray<IndependentBudgetReferenceLine>; readonly referenceSourceDescription?: string } = {},
): BudgetDocumentEconomicCharacterizationResult {
  const identityFingerprint = computeIdentityFingerprint(input);
  try {
    const validation = validateEconomicCharacterizationInput(input);
    if (validation.kind === "invalid") return buildFailedResult(input, identityFingerprint, validation.problems);

    const g2 = input.pageLocalNeutralStructuredEvidence;
    const g3 = input.pageBoundaryNeutralContinuity;

    const proposedLines: ProposedBudgetLine[] = [];
    const technicalProblems: EconomicCharacterizationTechnicalProblem[] = [];

    for (const group of g2.groups) {
      const state: WalkState = { hierarchyContext: EMPTY_HIERARCHY_CONTEXT, documentaryOrder: 0, lastRoleAssignments: null, lastRegionKey: null, seenHeaderSignatures: new Set() };
      for (const page of group.pages) {
        for (const region of page.regions) {
          processRegion(group, page, region, g3.evaluations, state, proposedLines, technicalProblems);
        }
      }
    }

    const anyFailedLine = proposedLines.some((line) => line.extractionStatus === "technical_failure");
    const status: EconomicCharacterizationGlobalStatus = (technicalProblems.length > 0 || anyFailedLine) ? "characterized_with_problems" : "characterized";

    return buildResult(input, identityFingerprint, proposedLines, technicalProblems, status, options.referenceLines ?? null, options.referenceSourceDescription ?? null);
  } catch {
    return buildFailedResult(input, identityFingerprint, [problem("economic_characterization_unexpected_failure", "row_classification")]);
  }
}

export { parseHierarchicalCode };
