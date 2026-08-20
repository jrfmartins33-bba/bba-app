import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContractBaselineRepository,
  ConsortiumRepository,
  CostCenterRepository,
} from "@bba/bdos-core/services/contract-baseline";
import {
  ContractBaselineStatus,
  type ContractBaseline,
} from "@bba/bdos-core/domain/contract-baseline";
import {
  ConsortiumCompositionStatus,
  type Consortium,
  type ConsortiumMember,
} from "@bba/bdos-core/domain/consortium";
import {
  CostCenterStatus,
  type ProjectCostCenter,
} from "@bba/bdos-core/domain/cost-center";

export function createContractBaselineRepository(supabase: SupabaseClient): ContractBaselineRepository {
  return {
    async saveContractBaseline(_organizationId, _actor, baseline) {
      return baseline;
    },

    async findContractBaselineById(organizationId, id) {
      const { data, error } = await supabase
        .from("contract_baselines")
        .select("*")
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data ? mapContractBaselineRow(data) : null;
    },

    async findContractBaselineByProject(organizationId, projectId) {
      const { data, error } = await supabase
        .from("contract_baselines")
        .select("*")
        .eq("company_id", organizationId)
        .eq("engineering_project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ? mapContractBaselineRow(data) : null;
    },
  };
}

export function createConsortiumRepository(supabase: SupabaseClient): ConsortiumRepository {
  return {
    async saveConsortium(_organizationId, _actor, consortium) {
      return consortium;
    },

    async findConsortiumById(organizationId, id) {
      const { data: consortiumRow, error: cErr } = await supabase
        .from("consortia")
        .select("*")
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();

      if (cErr) throw cErr;
      if (!consortiumRow) return null;

      const { data: memberRows, error: mErr } = await supabase
        .from("consortium_members")
        .select("*")
        .eq("consortium_id", id)
        .order("is_leader", { ascending: false });

      if (mErr) throw mErr;

      return mapConsortiumAggregate(consortiumRow, memberRows ?? []);
    },
  };
}

export function createCostCenterRepository(supabase: SupabaseClient): CostCenterRepository {
  return {
    async saveCostCenter(_organizationId, _actor, costCenter) {
      return costCenter;
    },

    async listCostCentersByProject(organizationId, projectId) {
      const { data, error } = await supabase
        .from("project_cost_centers")
        .select("*")
        .eq("company_id", organizationId)
        .eq("engineering_project_id", projectId)
        .order("code", { ascending: true });

      if (error) throw error;
      return (data ?? []).map(mapCostCenterRow);
    },

    async findCostCenterById(organizationId, id) {
      const { data, error } = await supabase
        .from("project_cost_centers")
        .select("*")
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data ? mapCostCenterRow(data) : null;
    },
  };
}

function mapContractBaselineRow(row: Record<string, unknown>): ContractBaseline {
  return {
    id: String(row.id),
    organizationId: String(row.company_id),
    engineeringProjectId: String(row.engineering_project_id),
    procurementCaseId: row.procurement_case_id ? String(row.procurement_case_id) : null,
    consortiumId: row.consortium_id ? String(row.consortium_id) : null,
    sourceBudgetVersionId: row.source_budget_version_id ? String(row.source_budget_version_id) : null,
    contractNumber: String(row.contract_number ?? ""),
    contractorNameSnapshot: String(row.contractor_name_snapshot ?? ""),
    status: (row.status as ContractBaselineStatus) ?? ContractBaselineStatus.Draft,
    contractedValueCents: Number(row.contracted_value_cents ?? 0),
    historicalOfficialBudgetCents: row.historical_official_budget_cents !== null && row.historical_official_budget_cents !== undefined
      ? Number(row.historical_official_budget_cents)
      : null,
    derivedItemsTotalDecimal: String(row.derived_items_total_decimal ?? "0.00000000"),
    contractualRoundingAdjustmentDecimal: String(row.contractual_rounding_adjustment_decimal ?? "0.00000000"),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapConsortiumAggregate(
  consortiumRow: Record<string, unknown>,
  memberRows: ReadonlyArray<Record<string, unknown>>,
): Consortium {
  const members: ConsortiumMember[] = memberRows.map((m) => ({
    id: String(m.id),
    consortiumId: String(m.consortium_id),
    partyNameSnapshot: String(m.party_name_snapshot ?? ""),
    partyTradeNameSnapshot: m.party_trade_name_snapshot ? String(m.party_trade_name_snapshot) : null,
    partyIdentifier: m.party_identifier ? String(m.party_identifier) : null,
    shareBasisPoints: Number(m.share_basis_points ?? 0),
    isLeader: Boolean(m.is_leader),
    memberOrganizationId: m.member_company_id ? String(m.member_company_id) : null,
    metadata: (m.metadata as Record<string, unknown>) ?? {},
  }));

  return {
    id: String(consortiumRow.id),
    organizationId: String(consortiumRow.company_id),
    legalName: String(consortiumRow.legal_name ?? ""),
    tradeName: consortiumRow.trade_name ? String(consortiumRow.trade_name) : null,
    cnpj: consortiumRow.cnpj ? String(consortiumRow.cnpj) : null,
    compositionStatus: (consortiumRow.composition_status as ConsortiumCompositionStatus) ?? ConsortiumCompositionStatus.Draft,
    members,
    metadata: (consortiumRow.metadata as Record<string, unknown>) ?? {},
  };
}

function mapCostCenterRow(row: Record<string, unknown>): ProjectCostCenter {
  return {
    id: String(row.id),
    organizationId: String(row.company_id),
    engineeringProjectId: String(row.engineering_project_id),
    consortiumMemberId: row.consortium_member_id ? String(row.consortium_member_id) : null,
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    status: (row.status as CostCenterStatus) ?? CostCenterStatus.Active,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}
