import type { SupabaseClient } from "@supabase/supabase-js";

// Advisor Lab (Sprint 14.2A) — leituras cross-company só para admin.
// Depende inteiramente da RLS já existente (is_bba_admin() nas policies
// de engineering_projects/decision_snapshots/recommendations, ver
// supabase/migrations/20260707180000_bdos_core_schema.sql) — nenhuma
// tabela, policy ou coluna nova, nenhuma migração. Só leitura: nenhuma
// função aqui grava nada.
//
// listDecisionSnapshotsForProject/getSnapshotDetailForLab reusam o mesmo
// formato de query que apps/web/lib/bdos/advisor.ts já usa para "o
// snapshot mais recente da empresa autenticada" — mas para um snapshot
// arbitrário, escolhido pelo admin, de qualquer empresa. advisor.ts não é
// alterado; esta é uma leitura paralela, não uma generalização dele.

export interface AdvisorLabProjectSummary {
  readonly engineeringProjectId: string;
  readonly engineeringProjectName: string;
  readonly companyId: string;
  readonly companyName: string;
}

export const listEngineeringProjectsForLab = async (
  supabase: SupabaseClient
): Promise<ReadonlyArray<AdvisorLabProjectSummary>> => {
  const { data, error } = await supabase
    .from("engineering_projects")
    .select("id, name, company_id, companies(name)")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const companyRelation = row.companies as unknown as { name: string } | { name: string }[] | null;
    const companyName = Array.isArray(companyRelation)
      ? (companyRelation[0]?.name ?? "Empresa")
      : (companyRelation?.name ?? "Empresa");

    return {
      engineeringProjectId: row.id as string,
      engineeringProjectName: row.name as string,
      companyId: row.company_id as string,
      companyName
    };
  });
};

export interface AdvisorLabSnapshotSummary {
  readonly decisionSnapshotId: string;
  readonly computedAt: string;
  readonly healthScore: number | null;
  readonly triggerReason: string;
}

export const listDecisionSnapshotsForProject = async (
  supabase: SupabaseClient,
  engineeringProjectId: string
): Promise<ReadonlyArray<AdvisorLabSnapshotSummary>> => {
  const { data, error } = await supabase
    .from("decision_snapshots")
    .select("id, computed_at, health_score, trigger_reason")
    .eq("engineering_project_id", engineeringProjectId)
    .order("computed_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    decisionSnapshotId: row.id as string,
    computedAt: row.computed_at as string,
    healthScore: (row.health_score as number | null) ?? null,
    triggerReason: row.trigger_reason as string
  }));
};

export interface AdvisorLabSnapshotDetail {
  readonly decisionSnapshotId: string;
  readonly engineeringProjectId: string;
  readonly engineeringProjectName: string;
  readonly computedAt: string;
  readonly healthScore: number | null;
  readonly previousHealthScore: number | null;
  readonly decisions: unknown;
  readonly recommendations: unknown;
  readonly eligibleRecommendationIds: ReadonlySet<string>;
}

export const getSnapshotDetailForLab = async (
  supabase: SupabaseClient,
  decisionSnapshotId: string
): Promise<AdvisorLabSnapshotDetail | null> => {
  const { data: snapshot, error: snapshotError } = await supabase
    .from("decision_snapshots")
    .select(
      "id, engineering_project_id, computed_at, health_score, decisions, recommendations, engineering_projects(name)"
    )
    .eq("id", decisionSnapshotId)
    .maybeSingle();

  if (snapshotError) {
    throw snapshotError;
  }

  if (!snapshot) {
    return null;
  }

  const engineeringProjectId = snapshot.engineering_project_id as string;
  const engineeringProjectRelation = snapshot.engineering_projects as unknown as
    | { name: string }
    | { name: string }[]
    | null;
  const engineeringProjectName = Array.isArray(engineeringProjectRelation)
    ? (engineeringProjectRelation[0]?.name ?? "Projeto de Engenharia")
    : (engineeringProjectRelation?.name ?? "Projeto de Engenharia");

  const [previousSnapshotResult, openRecommendationsResult] = await Promise.all([
    supabase
      .from("decision_snapshots")
      .select("health_score")
      .eq("engineering_project_id", engineeringProjectId)
      .lt("computed_at", snapshot.computed_at as string)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("recommendations")
      .select("recommendation_ref_id")
      .eq("engineering_project_id", engineeringProjectId)
      .eq("status", "open")
  ]);

  if (previousSnapshotResult.error) throw previousSnapshotResult.error;
  if (openRecommendationsResult.error) throw openRecommendationsResult.error;

  const eligibleRecommendationIds = new Set(
    (openRecommendationsResult.data ?? [])
      .map((row) => row.recommendation_ref_id as string | null)
      .filter((id): id is string => typeof id === "string")
  );

  return {
    decisionSnapshotId: snapshot.id as string,
    engineeringProjectId,
    engineeringProjectName,
    computedAt: snapshot.computed_at as string,
    healthScore: (snapshot.health_score as number | null) ?? null,
    previousHealthScore: (previousSnapshotResult.data?.health_score as number | null) ?? null,
    decisions: snapshot.decisions,
    recommendations: snapshot.recommendations,
    eligibleRecommendationIds
  };
};
