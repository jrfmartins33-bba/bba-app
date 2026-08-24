import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContractExecutionItemLinkRevalidation,
  ContractExecutionItemTraceabilityRepository,
  PersistContractExecutionItemLinksResult,
} from "@bba/bdos-core/services/contract-execution-item-traceability";
import type { ContractExecutionItemLinkManifest } from "@bba/bdos-core/domain/contract-execution-item-link";

export function createContractExecutionItemTraceabilityRepository(
  supabase: SupabaseClient,
): ContractExecutionItemTraceabilityRepository {
  return {
    async revalidateManifest(manifest) {
      const { data, error } = await supabase.rpc(
        "revalidate_contract_execution_item_link_manifest",
        { p_manifest: manifest },
      );
      if (error) throw error;
      return mapRevalidation(data);
    },

    async persistManifestAtomically(actorId, approvalReference, manifest) {
      const { data, error } = await supabase.rpc(
        "persist_contract_execution_item_links_manifest",
        {
          p_actor_id: actorId,
          p_approval_reference: approvalReference,
          p_manifest: manifest,
        },
      );
      if (error) throw error;
      return mapPersistenceResult(data);
    },

    async listByContractBaseline(organizationId, contractBaselineId) {
      const { data, error } = await supabase
        .from("contract_execution_item_links")
        .select("*")
        .eq("company_id", organizationId)
        .eq("contract_baseline_id", contractBaselineId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  };
}

function mapRevalidation(value: unknown): ContractExecutionItemLinkRevalidation {
  const row = asRecord(value);
  return {
    ready: Boolean(row.ready),
    violations: Array.isArray(row.violations) ? row.violations.map(String) : [],
    currentIntegrityId: String(row.currentIntegrityId ?? ""),
    proposalItemCount: Number(row.proposalItemCount ?? 0),
    operationalItemCount: Number(row.operationalItemCount ?? 0),
    validPairCount: Number(row.validPairCount ?? 0),
    distinctProposalLineCount: Number(row.distinctProposalLineCount ?? 0),
    distinctOperationalItemCount: Number(row.distinctOperationalItemCount ?? 0),
    sourceSnapshotsMatch: Boolean(row.sourceSnapshotsMatch),
    baselineStillPointsToProposal: Boolean(row.baselineStillPointsToProposal),
    economicsUnchanged: Boolean(row.economicsUnchanged),
  };
}

function mapPersistenceResult(value: unknown): PersistContractExecutionItemLinksResult {
  const row = asRecord(value);
  return {
    insertedCount: Number(row.insertedCount ?? 0),
    integrityId: String(row.integrityId ?? ""),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Unexpected contract execution traceability RPC response.");
}

export type { ContractExecutionItemLinkManifest };
