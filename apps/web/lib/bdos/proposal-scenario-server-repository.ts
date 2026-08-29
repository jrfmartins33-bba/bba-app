import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROPOSAL_SCENARIO_CALCULATION_METHOD,
  ProposalScenarioComparisonKind,
  type ProposalScenario,
  type ProposalScenarioRepository,
} from "@bba/bdos-core/services/proposal-scenarios";

const COLUMNS =
  "id, company_id, source_budget_version_id, source_budget_version_revision, name, official_value_cents, target_value_cents, difference_cents, difference_basis_points, comparison_kind, calculation_method, parameters, created_by, created_at";

interface ScenarioRow {
  readonly id: string;
  readonly company_id: string;
  readonly source_budget_version_id: string;
  readonly source_budget_version_revision: number;
  readonly name: string;
  readonly official_value_cents: string | number;
  readonly target_value_cents: string | number;
  readonly difference_cents: string | number;
  readonly difference_basis_points: string | number;
  readonly comparison_kind: string;
  readonly calculation_method: string;
  readonly parameters: Record<string, unknown>;
  readonly created_by: string;
  readonly created_at: string;
}

export function createProposalScenarioRepository(
  readClient: SupabaseClient,
  writeClient: SupabaseClient,
): ProposalScenarioRepository {
  return {
    async createScenario(organizationId, actor, scenario) {
      const { data, error } = await writeClient.rpc("create_proposal_scenario", {
        p_actor_id: actor,
        p_company_id: organizationId,
        p_id: scenario.id,
        p_source_budget_version_id: scenario.sourceBudgetVersionId,
        p_source_budget_version_revision: scenario.sourceBudgetVersionRevision,
        p_name: scenario.name,
        p_official_value_cents: scenario.officialValueCents,
        p_target_value_cents: scenario.targetValueCents,
        p_difference_cents: scenario.differenceCents,
        p_difference_basis_points: scenario.differenceBasisPoints,
        p_comparison_kind: scenario.comparisonKind,
        p_calculation_method: scenario.calculationMethod,
        p_created_at: scenario.createdAt,
      });

      if (error || data === null) throw error ?? new Error("Falha ao salvar o cenário.");
      return mapScenarioRow(data as ScenarioRow);
    },

    async findScenarioById(organizationId, id) {
      const { data, error } = await readClient
        .from("proposal_scenarios")
        .select(COLUMNS)
        .eq("company_id", organizationId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data === null ? null : mapScenarioRow(data as ScenarioRow);
    },

    async listScenarios(organizationId, sourceBudgetVersionId) {
      let query = readClient
        .from("proposal_scenarios")
        .select(COLUMNS)
        .eq("company_id", organizationId)
        .order("created_at", { ascending: false });
      if (sourceBudgetVersionId) query = query.eq("source_budget_version_id", sourceBudgetVersionId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => mapScenarioRow(row as ScenarioRow));
    },
  };
}

export function mapScenarioRow(row: ScenarioRow): ProposalScenario {
  const comparisonKind = mapComparisonKind(row.comparison_kind);
  if (row.calculation_method !== PROPOSAL_SCENARIO_CALCULATION_METHOD) {
    throw new Error("Método de cálculo de cenário desconhecido.");
  }
  const targetValueCents = money(row.target_value_cents, "target_value_cents");
  if (row.parameters?.authority !== "target_value_cents" || money(row.parameters.targetValueCents, "parameters.targetValueCents") !== targetValueCents) {
    throw new Error("Parâmetros persistidos do cenário são inconsistentes.");
  }

  return {
    id: nonBlank(row.id, "id"),
    organizationId: nonBlank(row.company_id, "company_id"),
    sourceBudgetVersionId: nonBlank(row.source_budget_version_id, "source_budget_version_id"),
    sourceBudgetVersionRevision: nonNegativeInteger(row.source_budget_version_revision, "source_budget_version_revision"),
    name: nonBlank(row.name, "name"),
    officialValueCents: money(row.official_value_cents, "official_value_cents"),
    targetValueCents,
    differenceCents: money(row.difference_cents, "difference_cents"),
    differenceBasisPoints: integerText(row.difference_basis_points, "difference_basis_points"),
    comparisonKind,
    calculationMethod: PROPOSAL_SCENARIO_CALCULATION_METHOD,
    parameters: { authority: "target_value_cents", targetValueCents },
    createdBy: nonBlank(row.created_by, "created_by"),
    createdAt: nonBlank(row.created_at, "created_at"),
  };
}

function mapComparisonKind(value: string): ProposalScenarioComparisonKind {
  if (value === ProposalScenarioComparisonKind.Reduction) return ProposalScenarioComparisonKind.Reduction;
  if (value === ProposalScenarioComparisonKind.Increase) return ProposalScenarioComparisonKind.Increase;
  if (value === ProposalScenarioComparisonKind.Equal) return ProposalScenarioComparisonKind.Equal;
  throw new Error("Classificação de comparação desconhecida.");
}

function money(value: unknown, field: string): number {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${field} inválido.`);
  return parsed;
}

function integerText(value: unknown, field: string): string {
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new Error(`${field} inválido.`);
  return text;
}

function nonBlank(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} inválido.`);
  return value;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${field} inválido.`);
  return value;
}
