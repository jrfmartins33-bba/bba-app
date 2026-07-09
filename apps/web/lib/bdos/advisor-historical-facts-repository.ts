import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineeringAdvisorContext } from "@bba/bdos-core/advisor/advisor-context.types";
import type {
  EngineeringAdvisorHistoricalFacts,
  EngineeringAdvisorPreviousDecisionFact
} from "@bba/bdos-core/advisor/advisor-historical-facts.types";

// Epic 14 (BBA Advisor Evolution), Sprint 14.3 — Engineering Advisor
// Memory. Único responsável por buscar o dado cru de histórico no
// Supabase; toda a interpretação (isNew, priorityChanged, recurring)
// acontece em buildEngineeringAdvisorPromptContext (bdos-core), não aqui.
//
// Duas buscas, nenhuma delas traz conteúdo bruto de snapshots antigos
// para o prompt — só o suficiente para calcular dois fatos:
// 1. previousDecisions: id+priority do snapshot IMEDIATAMENTE anterior
//    (2 pontos, não a série completa) — usado para saber se uma Decision
//    já existia e se a prioridade mudou.
// 2. recommendationOpenSinceImportCountByRefId: quantos
//    decision_snapshots com trigger_reason='import' aconteceram desde
//    que cada recommendation do Candidate Set atual apareceu pela
//    primeira vez (recommendations.created_at) — uma contagem por item,
//    nunca N payloads. Funciona porque Recommendation.id é estável entre
//    reimports do mesmo risco (correlationId fixo por
//    engineeringProjectId, ver apps/web/app/api/bba-project/import/route.ts).
export const getEngineeringAdvisorHistoricalFacts = async (
  supabase: SupabaseClient,
  context: EngineeringAdvisorContext
): Promise<EngineeringAdvisorHistoricalFacts> => {
  const { engineeringProjectId, computedAt } = context.snapshot;
  const recommendationRefIds = context.recommendations.map((recommendation) => recommendation.id);

  const [previousSnapshotResult, importSnapshotsResult, recommendationCreatedAtResult] = await Promise.all([
    supabase
      .from("decision_snapshots")
      .select("decisions")
      .eq("engineering_project_id", engineeringProjectId)
      .lt("computed_at", computedAt)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("decision_snapshots")
      .select("computed_at")
      .eq("engineering_project_id", engineeringProjectId)
      .eq("trigger_reason", "import"),
    recommendationRefIds.length > 0
      ? supabase
          .from("recommendations")
          .select("recommendation_ref_id, created_at")
          .eq("engineering_project_id", engineeringProjectId)
          .in("recommendation_ref_id", recommendationRefIds)
      : Promise.resolve({ data: [] as Array<{ recommendation_ref_id: string; created_at: string }>, error: null })
  ]);

  if (previousSnapshotResult.error) throw previousSnapshotResult.error;
  if (importSnapshotsResult.error) throw importSnapshotsResult.error;
  if (recommendationCreatedAtResult.error) throw recommendationCreatedAtResult.error;

  const previousDecisionsRaw = (previousSnapshotResult.data?.decisions ??
    []) as unknown as ReadonlyArray<EngineeringAdvisorPreviousDecisionFact>;
  const previousDecisions: EngineeringAdvisorPreviousDecisionFact[] = previousDecisionsRaw.map((decision) => ({
    id: decision.id,
    priority: decision.priority
  }));

  const importComputedAts = (importSnapshotsResult.data ?? []).map((row) => row.computed_at as string);

  const recommendationOpenSinceImportCountByRefId: Record<string, number> = {};
  for (const row of recommendationCreatedAtResult.data ?? []) {
    const refId = row.recommendation_ref_id as string;
    const createdAt = row.created_at as string;
    recommendationOpenSinceImportCountByRefId[refId] = importComputedAts.filter(
      (importComputedAt) => importComputedAt >= createdAt
    ).length;
  }

  return { previousDecisions, recommendationOpenSinceImportCountByRefId };
};
