import {
  validateContractExecutionItemLinkManifest,
  type ContractExecutionItemLinkManifest,
} from "../../domain/contract-execution-item-link";
import type {
  ContractExecutionItemTraceabilityRepository,
  PersistContractExecutionItemLinksResult,
} from "./contract-execution-item-traceability.repository";

export interface ContractExecutionItemLinkPersistencePreview {
  readonly ready: boolean;
  readonly plannedInsertCount: number;
  readonly integrityId: string;
  readonly violations: ReadonlyArray<string>;
  readonly mutationScope: {
    readonly createsOperationalItems: false;
    readonly changesProposal: false;
    readonly changesContractBaseline: false;
    readonly changesExecution: false;
    readonly changesMeasurements: false;
    readonly changesEconomics: false;
    readonly changesHierarchy: false;
  };
}

export async function previewContractExecutionItemLinkPersistence(
  manifest: ContractExecutionItemLinkManifest,
  repository: ContractExecutionItemTraceabilityRepository,
): Promise<ContractExecutionItemLinkPersistencePreview> {
  const local = validateContractExecutionItemLinkManifest(manifest);
  const remote = local.valid ? await repository.revalidateManifest(manifest) : null;
  const violations = [...local.violations, ...(remote?.violations ?? [])];
  const expected = manifest.integrity;
  const ready =
    local.valid &&
    remote?.ready === true &&
    remote.currentIntegrityId === manifest.integrity.validationSetIntegrityId &&
    remote.proposalItemCount === expected.expectedDistinctProposalLineCount &&
    remote.operationalItemCount === expected.expectedDistinctOperationalItemCount &&
    remote.validPairCount === expected.expectedLinkCount &&
    remote.distinctProposalLineCount === expected.expectedDistinctProposalLineCount &&
    remote.distinctOperationalItemCount === expected.expectedDistinctOperationalItemCount &&
    remote.sourceSnapshotsMatch &&
    remote.baselineStillPointsToProposal &&
    remote.economicsUnchanged;

  if (local.valid && !ready && violations.length === 0) {
    violations.push("Authoritative pre-write revalidation did not satisfy every guard.");
  }

  return {
    ready,
    plannedInsertCount: ready ? manifest.links.length : 0,
    integrityId: manifest.integrity.validationSetIntegrityId,
    violations,
    mutationScope: {
      createsOperationalItems: false,
      changesProposal: false,
      changesContractBaseline: false,
      changesExecution: false,
      changesMeasurements: false,
      changesEconomics: false,
      changesHierarchy: false,
    },
  };
}

export async function persistApprovedContractExecutionItemLinks(
  actorId: string,
  approvalReference: string,
  manifest: ContractExecutionItemLinkManifest,
  repository: ContractExecutionItemTraceabilityRepository,
): Promise<PersistContractExecutionItemLinksResult> {
  if (!actorId.trim() || !approvalReference.trim()) {
    throw new Error("Explicit actor and human approval reference are required.");
  }
  const preview = await previewContractExecutionItemLinkPersistence(manifest, repository);
  if (!preview.ready) {
    throw new Error("Persistence blocked: " + preview.violations.join(" "));
  }
  return repository.persistManifestAtomically(actorId, approvalReference, manifest);
}
