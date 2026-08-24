import type { ContractExecutionItemLinkManifest } from "../../domain/contract-execution-item-link";

export interface ContractExecutionItemLinkRevalidation {
  readonly ready: boolean;
  readonly violations: ReadonlyArray<string>;
  readonly currentIntegrityId: string;
  readonly proposalItemCount: number;
  readonly operationalItemCount: number;
  readonly validPairCount: number;
  readonly distinctProposalLineCount: number;
  readonly distinctOperationalItemCount: number;
  readonly sourceSnapshotsMatch: boolean;
  readonly baselineStillPointsToProposal: boolean;
  readonly economicsUnchanged: boolean;
}

export interface PersistContractExecutionItemLinksResult {
  readonly insertedCount: number;
  readonly integrityId: string;
}

export interface ContractExecutionItemTraceabilityRepository {
  revalidateManifest(
    manifest: ContractExecutionItemLinkManifest,
  ): Promise<ContractExecutionItemLinkRevalidation>;

  persistManifestAtomically(
    actorId: string,
    approvalReference: string,
    manifest: ContractExecutionItemLinkManifest,
  ): Promise<PersistContractExecutionItemLinksResult>;

  listByContractBaseline(
    organizationId: string,
    contractBaselineId: string,
  ): Promise<ReadonlyArray<unknown>>;
}
