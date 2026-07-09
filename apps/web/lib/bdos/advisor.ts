import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEngineeringAdvisorContext } from "@bba/bdos-core/advisor/advisor-context-builder";
import type {
  Decision,
  EngineeringAdvisorContext,
  Recommendation
} from "@bba/bdos-core/advisor/advisor-context.types";

// Advisor de Engenharia (Sprint 13.10, Home "Hoje") — camada de
// orquestração pura: só lê o que os Sprints 13.4-13.9 já gravam
// (decision_snapshots, recommendations, planning_imports) e monta uma
// narrativa. Nenhum cálculo novo vive aqui — Health Score já foi
// congelado no momento do import (ver route.ts, computeHealthScore),
// severidade de recomendação já foi copiada no momento da criação
// (ver repository.ts, persistRecommendation). Este módulo só
// consulta e ordena.
//
// Este é o primeiro de vários Advisors especializados (Engenharia
// hoje; Financeiro/RH/Comercial quando esses Studios existirem) que a
// Home vai um dia orquestrar em uma única narrativa corporativa — por
// isso o formato de retorno (lista de items com severidade) é
// deliberadamente genérico, não amarrado a nenhum detalhe específico
// de engenharia.

const STALE_RECOMMENDATION_DAYS = 30;
const SEVERITY_RANK: Readonly<Record<string, number>> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};
const HIGH_SEVERITY_THRESHOLD = SEVERITY_RANK.high;

export type EngineeringAdvisorSeverity = "critical" | "attention" | "info" | "trend";

export interface EngineeringAdvisorItem {
  readonly severity: EngineeringAdvisorSeverity;
  readonly headline: string;
  readonly detail: string;
  readonly actionLabel: string;
  readonly actionHref: string;
}

export interface EngineeringAdvisorBriefing {
  readonly hasData: boolean;
  readonly engineeringProjectId: string | null;
  readonly engineeringProjectName: string | null;
  readonly items: ReadonlyArray<EngineeringAdvisorItem>;
  readonly narrative: string | null;
  readonly context: EngineeringAdvisorContext | null;
}

const PROJECT_STUDIO_HREF = "/bba-project";

export const getEngineeringAdvisorBriefing = async (
  supabase: SupabaseClient,
  companyId: string
): Promise<EngineeringAdvisorBriefing> => {
  const { data: latestSnapshot, error: latestError } = await supabase
    .from("decision_snapshots")
    .select("id, engineering_project_id, computed_at, health_score, decisions, recommendations, engineering_projects(name)")
    .eq("company_id", companyId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw latestError;
  }

  if (!latestSnapshot) {
    return {
      hasData: false,
      engineeringProjectId: null,
      engineeringProjectName: null,
      items: [],
      narrative: null,
      context: null
    };
  }

  const engineeringProjectId = latestSnapshot.engineering_project_id as string;
  const engineeringProjectRelation = latestSnapshot.engineering_projects as unknown as
    | { name: string }
    | { name: string }[]
    | null;
  const engineeringProjectName = Array.isArray(engineeringProjectRelation)
    ? (engineeringProjectRelation[0]?.name ?? "Projeto de Engenharia")
    : (engineeringProjectRelation?.name ?? "Projeto de Engenharia");

  const staleThreshold = new Date(Date.now() - STALE_RECOMMENDATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [previousSnapshotResult, openRecommendationsResult, staleCountResult, latestImportResult, narrativeResult] =
    await Promise.all([
      supabase
        .from("decision_snapshots")
        .select("health_score")
        .eq("engineering_project_id", engineeringProjectId)
        .lt("computed_at", latestSnapshot.computed_at as string)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("recommendations")
        .select("title, severity, recommendation_ref_id")
        .eq("engineering_project_id", engineeringProjectId)
        .eq("status", "open"),
      supabase
        .from("recommendations")
        .select("id", { count: "exact", head: true })
        .eq("engineering_project_id", engineeringProjectId)
        .eq("status", "open")
        .lt("created_at", staleThreshold),
      supabase
        .from("planning_imports")
        .select("file_name, uploaded_at")
        .eq("engineering_project_id", engineeringProjectId)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("advisor_narratives")
        .select("narrative")
        .eq("decision_snapshot_id", latestSnapshot.id as string)
        .maybeSingle()
    ]);

  if (previousSnapshotResult.error) throw previousSnapshotResult.error;
  if (openRecommendationsResult.error) throw openRecommendationsResult.error;
  if (staleCountResult.error) throw staleCountResult.error;
  if (latestImportResult.error) throw latestImportResult.error;
  if (narrativeResult.error) throw narrativeResult.error;

  const items: EngineeringAdvisorItem[] = [];

  const openRecommendations = openRecommendationsResult.data ?? [];
  const criticalRecommendations = openRecommendations.filter(
    (recommendation) => (SEVERITY_RANK[recommendation.severity] ?? 0) >= HIGH_SEVERITY_THRESHOLD
  );
  const mediumRecommendations = openRecommendations.filter(
    (recommendation) => (SEVERITY_RANK[recommendation.severity] ?? 0) === SEVERITY_RANK.medium
  );
  const topCriticalRecommendation = [...criticalRecommendations].sort(
    (a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
  )[0];

  // "Crítico" e "Atenção" refletem severidade real das recommendations
  // abertas agora — não só as que já passaram de 30 dias (isso é um
  // segundo sinal, de aging, tratado separadamente abaixo). Sem isso,
  // recomendações medium recém-criadas ficariam invisíveis na Home até
  // completarem 30 dias, o que seria uma Home otimista demais.
  if (topCriticalRecommendation) {
    items.push({
      severity: "critical",
      headline: topCriticalRecommendation.title,
      detail: `Identificado no projeto "${engineeringProjectName}".`,
      actionLabel: "Abrir Project Studio",
      actionHref: PROJECT_STUDIO_HREF
    });
  } else if (mediumRecommendations.length > 0) {
    items.push({
      severity: "attention",
      headline: `Existem ${mediumRecommendations.length} recomendaç${mediumRecommendations.length > 1 ? "ões abertas" : "ão aberta"} que merecem atenção.`,
      detail: mediumRecommendations[0]?.title ?? "",
      actionLabel: "Ver Recomendações",
      actionHref: PROJECT_STUDIO_HREF
    });
  }

  const staleCount = staleCountResult.count ?? 0;
  if (staleCount > 0) {
    items.push({
      severity: "attention",
      headline: `Existem ${staleCount} recomendaç${staleCount > 1 ? "ões abertas" : "ão aberta"} há mais de ${STALE_RECOMMENDATION_DAYS} dias.`,
      detail: "Recomendações antigas sem tratamento reduzem a confiabilidade do Advisor.",
      actionLabel: "Ver Recomendações",
      actionHref: PROJECT_STUDIO_HREF
    });
  }

  const latestImport = latestImportResult.data;
  if (latestImport) {
    items.push({
      severity: "info",
      headline:
        openRecommendations.length === 0
          ? "Nenhuma divergência foi encontrada no último import."
          : `O último import (${latestImport.file_name}) foi processado com sucesso.`,
      detail: `Última importação em ${new Date(latestImport.uploaded_at as string).toLocaleDateString("pt-BR")}.`,
      actionLabel: "Executar novo Import",
      actionHref: PROJECT_STUDIO_HREF
    });
  }

  const previousHealthScore = previousSnapshotResult.data?.health_score ?? null;
  const currentHealthScore = latestSnapshot.health_score;
  if (typeof currentHealthScore === "number" && typeof previousHealthScore === "number" && previousHealthScore !== currentHealthScore) {
    const direction = currentHealthScore > previousHealthScore ? "subiu" : "caiu";
    items.push({
      severity: "trend",
      headline: `O Health Score da engenharia ${direction} de ${previousHealthScore} para ${currentHealthScore}.`,
      detail: "",
      actionLabel: "Abrir Project Studio",
      actionHref: PROJECT_STUDIO_HREF
    });
  }

  // Epic 14 (BBA Advisor Evolution), Sprint 14.1 — Candidate Set usa
  // exatamente a mesma elegibilidade da query acima (`status = "open"`,
  // ver openRecommendationsResult): não há uma segunda regra de filtro
  // vivendo em bdos-core, só o resultado desta mesma query.
  const eligibleRecommendationIds = new Set(
    openRecommendations
      .map((recommendation) => recommendation.recommendation_ref_id as string | null)
      .filter((id): id is string => typeof id === "string")
  );

  const context = buildEngineeringAdvisorContext({
    engineeringProjectId,
    engineeringProjectName,
    computedAt: latestSnapshot.computed_at as string,
    healthScore: currentHealthScore as number,
    previousHealthScore,
    decisions: (latestSnapshot.decisions ?? []) as unknown as ReadonlyArray<Decision>,
    recommendations: (latestSnapshot.recommendations ?? []) as unknown as ReadonlyArray<Recommendation>,
    eligibleRecommendationIds
  });

  return {
    hasData: true,
    engineeringProjectId,
    engineeringProjectName,
    items,
    narrative: narrativeResult.data?.narrative ?? null,
    context
  };
};
