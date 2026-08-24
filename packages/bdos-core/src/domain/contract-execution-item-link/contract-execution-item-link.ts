import {
  ContractExecutionItemMatchMethod,
  type ContractExecutionItemLinkManifest,
  type ManifestValidationResult,
} from "./contract-execution-item-link.types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTEGRITY_PATTERN = /^[0-9a-f]{32}$/;

export function validateContractExecutionItemLinkManifest(
  manifest: ContractExecutionItemLinkManifest,
): ManifestValidationResult {
  const violations: string[] = [];
  const proposalIds = new Set<string>();
  const operationalIds = new Set<string>();
  let structuralMatches = 0;
  let remainderMatches = 0;

  if (manifest.writeStatus !== "NOT_APPLIED") {
    violations.push("Manifest must remain NOT_APPLIED before approval.");
  }
  if (!INTEGRITY_PATTERN.test(manifest.integrity.validationSetIntegrityId)) {
    violations.push("Invalid validation set integrity id.");
  }
  for (const id of [
    manifest.scope.organizationId,
    manifest.scope.engineeringProjectId,
    manifest.scope.contractBaselineId,
    manifest.scope.proposalBudgetVersionId,
  ]) {
    if (!UUID_PATTERN.test(id)) violations.push("Invalid internal UUID: " + id);
  }

  for (const link of manifest.links) {
    if (!UUID_PATTERN.test(link.proposalLine.id) || !UUID_PATTERN.test(link.operationalItem.id)) {
      violations.push("Pair " + link.sequence + " does not use permanent internal UUID identities.");
    }
    if (proposalIds.has(link.proposalLine.id)) {
      violations.push("Proposal line reused: " + link.proposalLine.id);
    }
    if (operationalIds.has(link.operationalItem.id)) {
      violations.push("Operational item reused: " + link.operationalItem.id);
    }
    proposalIds.add(link.proposalLine.id);
    operationalIds.add(link.operationalItem.id);

    if (
      !link.evidence.descriptionExact ||
      !link.evidence.unitExact ||
      !link.evidence.quantityExact ||
      !link.evidence.unitPriceExact ||
      !link.evidence.candidateUniqueInApplicableSet
    ) {
      violations.push("Pair " + link.sequence + " lacks deterministic material evidence.");
    }
    if (!link.evidence.externalCodesAreEvidenceOnly) {
      violations.push("Pair " + link.sequence + " treats an external code as identity.");
    }
    if (
      link.validation.status !== "Validated" ||
      link.validation.ambiguous !== false ||
      link.validation.materialDivergence !== false ||
      link.validation.proposalIdentityUsesInternalId !== true ||
      link.validation.operationalIdentityUsesInternalId !== true
    ) {
      violations.push("Pair " + link.sequence + " contains an unresolved or non-internal validation result.");
    }
    if (link.matchMethod === ContractExecutionItemMatchMethod.StructuralCodeAndExactMaterialFields) {
      structuralMatches += 1;
    } else if (link.matchMethod === ContractExecutionItemMatchMethod.UniqueExactDocumentaryRemainder) {
      remainderMatches += 1;
    } else {
      violations.push("Pair " + link.sequence + " has an unsupported match method.");
    }
  }

  const expected = manifest.integrity;
  if (
    expected.expectedLinkCount !== expected.expectedDistinctProposalLineCount ||
    expected.expectedLinkCount !== expected.expectedDistinctOperationalItemCount
  ) {
    violations.push("Expected cardinalities must describe a one-to-one set.");
  }
  if (manifest.links.length !== expected.expectedLinkCount) violations.push("Unexpected link count.");
  if (proposalIds.size !== expected.expectedDistinctProposalLineCount) violations.push("Proposal side is not one-to-one.");
  if (operationalIds.size !== expected.expectedDistinctOperationalItemCount) violations.push("Operational side is not one-to-one.");
  if (structuralMatches !== expected.structuralCodeAndExactMaterialFieldsCount) violations.push("Structural match count changed.");
  if (remainderMatches !== expected.uniqueExactDocumentaryRemainderCount) violations.push("Remainder match count changed.");
  if (
    expected.ambiguousCount !== 0 ||
    expected.unmatchedCount !== 0 ||
    expected.materialDivergenceCount !== 0
  ) {
    violations.push("Manifest contains unresolved validation results.");
  }
  if (manifest.economics.mutationPlanned !== false) violations.push("Economic mutation is prohibited.");

  return {
    valid: violations.length === 0,
    violations,
    linkCount: manifest.links.length,
    distinctProposalLineCount: proposalIds.size,
    distinctOperationalItemCount: operationalIds.size,
  };
}
