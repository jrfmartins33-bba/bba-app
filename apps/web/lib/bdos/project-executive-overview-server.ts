import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectContractualFoundationService } from "@bba/bdos-core/services/contract-baseline";
import {
  createContractBaselineRepository,
  createConsortiumRepository,
  createCostCenterRepository,
} from "./contract-baseline-server-repository";

export interface ProjectListItemDto {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly contractNumber: string | null;
  readonly contractedValueFormatted: string | null;
  readonly contractorName: string | null;
  readonly totalItemsCount: number;
  readonly createdAt: string;
}

export interface ProjectExecutiveOverviewDto {
  readonly project: {
    readonly id: string;
    readonly name: string;
    readonly status: string;
    readonly statusLabel: string;
    readonly contractNumber: string | null;
    readonly contractorName: string | null;
    readonly createdAt: string;
  };
  readonly contractualFoundation: {
    readonly baselineId: string | null;
    readonly contractNumber: string | null;
    readonly contractorName: string | null;
    readonly status: string | null;
    readonly contractedValueCents: number | null;
    readonly contractedValueFormatted: string | null;
    readonly derivedItemsTotalDecimal: string | null;
    readonly derivedItemsTotalFormatted: string | null;
    readonly roundingAdjustmentDecimal: string | null;
    readonly roundingAdjustmentFormatted: string | null;
    readonly historicalOfficialBudgetCents: number | null;
    readonly historicalOfficialBudgetFormatted: string | null;
    readonly consortium: {
      readonly id: string;
      readonly legalName: string;
      readonly tradeName: string | null;
      readonly cnpj: string | null;
      readonly compositionStatus: string;
      readonly members: ReadonlyArray<{
        readonly memberId: string;
        readonly partyName: string;
        readonly partyTradeName: string | null;
        readonly partyIdentifier: string | null;
        readonly sharePercentage: string;
        readonly shareBasisPoints: number;
        readonly isLeader: boolean;
        readonly costCenter: {
          readonly id: string;
          readonly code: string;
          readonly name: string;
        } | null;
      }>;
    } | null;
    readonly costCenters: ReadonlyArray<{
      readonly id: string;
      readonly code: string;
      readonly name: string;
      readonly consortiumMemberId: string | null;
    }>;
  };
  readonly planning: {
    readonly hasPlanning: boolean;
    readonly statusLabel: string;
    readonly latestFileName: string | null;
    readonly latestImportDate: string | null;
    readonly snapshotCount: number;
    readonly latestNarrative: {
      readonly title: string | null;
      readonly text: string;
      readonly contextNote: string;
    } | null;
  };
  readonly measurement: {
    readonly hasActiveMeasurement: boolean;
    readonly bulletinNumber: number | null;
    readonly status: string | null;
    readonly statusLabel: string;
    readonly analyzedLinesCount: number;
    readonly latestImportId: string | null;
    readonly latestImportFileName: string | null;
    readonly canOpenReport: boolean;
  };
  readonly structure: {
    readonly totalItemsCount: number;
    readonly mainScopeGroupsCount: number;
    readonly subScopeGroupsCount: number;
    readonly totalScopeGroupsCount: number;
    readonly scopeGroupsLabel: string;
    readonly itemsTotalValueFormatted: string | null;
  };
}

export async function listEngineeringProjectsOverview(
  queryClient: SupabaseClient,
  organizationId: string,
): Promise<ReadonlyArray<ProjectListItemDto>> {
  const { data: projects, error } = await queryClient
    .from("engineering_projects")
    .select("id, name, status, metadata, created_at")
    .eq("company_id", organizationId)
    .order("created_at", { ascending: false });

  if (error || !projects) {
    console.error("[listEngineeringProjectsOverview] Error loading projects:", error);
    return [];
  }

  const baselineRepo = createContractBaselineRepository(queryClient);
  const consortiumRepo = createConsortiumRepository(queryClient);
  const costCenterRepo = createCostCenterRepository(queryClient);

  const items: ProjectListItemDto[] = [];
  for (const p of projects) {
    const meta = (p.metadata as Record<string, unknown>) ?? {};
    const foundation = await getProjectContractualFoundationService(
      organizationId,
      p.id,
      {
        baselineRepository: baselineRepo,
        consortiumRepository: consortiumRepo,
        costCenterRepository: costCenterRepo,
      },
    );

    const { count: itemsCount } = await queryClient
      .from("managed_service_items")
      .select("*", { count: "exact", head: true })
      .eq("company_id", organizationId)
      .eq("engineering_project_id", p.id);

    const contractNumber = foundation.baseline?.contractNumber ?? (meta.contractNumber ? String(meta.contractNumber) : null);
    const contractorName = foundation.formattedSummary.consortiumName;
    const contractedValueFormatted = foundation.formattedSummary.contractedValue;

    items.push({
      id: p.id,
      name: p.name,
      status: p.status,
      statusLabel: mapProjectStatusLabel(p.status),
      contractNumber,
      contractedValueFormatted,
      contractorName,
      totalItemsCount: itemsCount ?? 0,
      createdAt: p.created_at,
    });
  }


  return items;
}

export async function loadProjectExecutiveOverview(
  queryClient: SupabaseClient,
  organizationId: string,
  projectId: string,
): Promise<ProjectExecutiveOverviewDto | null> {
  const { data: project, error: pErr } = await queryClient
    .from("engineering_projects")
    .select("id, name, status, metadata, created_at, workspace_id")
    .eq("company_id", organizationId)
    .eq("id", projectId)
    .maybeSingle();

  if (pErr || !project) {
    return null;
  }

  const baselineRepo = createContractBaselineRepository(queryClient);
  const consortiumRepo = createConsortiumRepository(queryClient);
  const costCenterRepo = createCostCenterRepository(queryClient);

  // 1. Contractual Foundation
  const foundation = await getProjectContractualFoundationService(
    organizationId,
    projectId,
    {
      baselineRepository: baselineRepo,
      consortiumRepository: consortiumRepo,
      costCenterRepository: costCenterRepo,
    },
  );

  const meta = (project.metadata as Record<string, unknown>) ?? {};
  const contractNumber = foundation.baseline?.contractNumber ?? (meta.contractNumber ? String(meta.contractNumber) : null);
  const contractorName = foundation.formattedSummary.consortiumName;

  // 2. Parallel structural and operational counts
  const [
    itemsCountRes,
    mainScopeGroupsRes,
    subScopeGroupsRes,
    planningImportRes,
    snapshotsCountRes,
    narrativeRes,
    workspaceRes,
    bulletinImportRes,
  ] = await Promise.all([
    queryClient
      .from("managed_service_items")
      .select("*", { count: "exact", head: true })
      .eq("company_id", organizationId)
      .eq("engineering_project_id", projectId),
    queryClient
      .from("work_packages")
      .select("*", { count: "exact", head: true })
      .eq("company_id", organizationId)
      .eq("engineering_project_id", projectId)
      .eq("type", "scope_group")
      .is("parent_work_package_id", null),
    queryClient
      .from("work_packages")
      .select("*", { count: "exact", head: true })
      .eq("company_id", organizationId)
      .eq("engineering_project_id", projectId)
      .eq("type", "scope_group")
      .not("parent_work_package_id", "is", null),
    queryClient
      .from("planning_imports")
      .select("id, file_name, created_at, status")
      .eq("company_id", organizationId)
      .eq("engineering_project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    queryClient
      .from("decision_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("company_id", organizationId)
      .eq("engineering_project_id", projectId),
    queryClient
      .from("advisor_narratives")
      .select("title, narrative, created_at")
      .eq("company_id", organizationId)
      .eq("engineering_project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    queryClient
      .from("measurement_workspaces")
      .select("id, declared_bulletin_number, status, created_at")
      .eq("company_id", organizationId)
      .eq("engineering_project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    queryClient
      .from("measurement_bulletin_imports")
      .select("id, file_name, status, created_at")
      .eq("company_id", organizationId)
      .eq("engineering_project_id", projectId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Analyzed measurement lines count (if workspace exists)
  let analyzedLinesCount = 0;
  if (workspaceRes.data?.id) {
    const { count } = await queryClient
      .from("measurement_workspace_lines")
      .select("*", { count: "exact", head: true })
      .eq("measurement_workspace_id", workspaceRes.data.id);
    analyzedLinesCount = count ?? 0;
  }

  const latestPlanningImport = planningImportRes.data;
  const hasPlanning = Boolean(latestPlanningImport);
  const latestNarrative = narrativeRes.data;

  const activeWorkspace = workspaceRes.data;
  const latestBulletinImport = bulletinImportRes.data;
  const hasActiveMeasurement = Boolean(activeWorkspace);

  const mainScopeGroupsCount = mainScopeGroupsRes.count ?? 0;
  const subScopeGroupsCount = subScopeGroupsRes.count ?? 0;
  const totalScopeGroupsCount = mainScopeGroupsCount + subScopeGroupsCount;
  const scopeGroupsLabel = `${mainScopeGroupsCount} grupos principais · ${subScopeGroupsCount} subgrupos`;

  const consortiumData = foundation.consortium
    ? {
        id: foundation.consortium.id,
        legalName: foundation.consortium.legalName,
        tradeName: foundation.consortium.tradeName,
        cnpj: foundation.consortium.cnpj,
        compositionStatus: foundation.consortium.compositionStatus,
        members: foundation.formattedSummary.members.map((m) => {
          const rawMember = foundation.consortium?.members.find((rm) => rm.id === m.memberId);
          return {
            memberId: m.memberId,
            partyName: m.partyName,
            partyTradeName: m.partyTradeName,
            partyIdentifier: rawMember?.partyIdentifier ?? null,
            sharePercentage: m.sharePercentage,
            shareBasisPoints: rawMember?.shareBasisPoints ?? 0,
            isLeader: m.isLeader,
            costCenter: m.costCenter,
          };
        }),
      }
    : null;

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      statusLabel: mapProjectStatusLabel(project.status),
      contractNumber,
      contractorName,
      createdAt: project.created_at,
    },
    contractualFoundation: {
      baselineId: foundation.baseline?.id ?? null,
      contractNumber: foundation.baseline?.contractNumber ?? contractNumber,
      contractorName: foundation.formattedSummary.consortiumName,
      status: foundation.baseline?.status ?? null,
      contractedValueCents: foundation.baseline?.contractedValueCents ?? null,
      contractedValueFormatted: foundation.formattedSummary.contractedValue,
      derivedItemsTotalDecimal: foundation.baseline?.derivedItemsTotalDecimal ?? null,
      derivedItemsTotalFormatted: foundation.formattedSummary.derivedItemsTotal,
      roundingAdjustmentDecimal: foundation.baseline?.contractualRoundingAdjustmentDecimal ?? null,
      roundingAdjustmentFormatted: foundation.formattedSummary.roundingAdjustment,
      historicalOfficialBudgetCents: foundation.baseline?.historicalOfficialBudgetCents ?? null,
      historicalOfficialBudgetFormatted: foundation.formattedSummary.historicalOfficialBudget,
      consortium: consortiumData,
      costCenters: foundation.costCenters.map((cc) => ({
        id: cc.id,
        code: cc.code,
        name: cc.name,
        consortiumMemberId: cc.consortiumMemberId,
      })),
    },
    planning: {
      hasPlanning,
      statusLabel: hasPlanning ? "Curva S disponível" : "Sem Planejamento",
      latestFileName: latestPlanningImport?.file_name ?? null,
      latestImportDate: latestPlanningImport?.created_at ?? null,
      snapshotCount: snapshotsCountRes.count ?? 0,
      latestNarrative: latestNarrative
        ? {
            title: latestNarrative.title ?? "Análise de Planejamento",
            text: latestNarrative.narrative,
            contextNote: "Análise registrada a partir da Curva S",
          }
        : null,
    },
    measurement: {
      hasActiveMeasurement,
      bulletinNumber: activeWorkspace?.declared_bulletin_number ?? null,
      status: activeWorkspace?.status ?? null,
      statusLabel: mapMeasurementStatusLabel(activeWorkspace?.status),
      analyzedLinesCount,
      latestImportId: latestBulletinImport?.id ?? null,
      latestImportFileName: latestBulletinImport?.file_name ?? null,
      canOpenReport: Boolean(latestBulletinImport?.id),
    },
    structure: {
      totalItemsCount: itemsCountRes.count ?? 0,
      mainScopeGroupsCount,
      subScopeGroupsCount,
      totalScopeGroupsCount,
      scopeGroupsLabel,
      itemsTotalValueFormatted: foundation.formattedSummary.derivedItemsTotal,
    },
  };
}

function mapProjectStatusLabel(status: string | null | undefined): string {
  if (!status) return "Em execução";
  const s = status.toLowerCase();
  if (s === "active" || s === "inexecution" || s === "in_execution") return "Em execução";
  if (s === "completed") return "Concluída";
  if (s === "suspended") return "Suspensa";
  return "Em execução";
}

function mapMeasurementStatusLabel(status: string | null | undefined): string {
  if (!status) return "Nenhuma medição em andamento";
  const s = status.toLowerCase();
  if (s === "inprogress" || s === "in_progress" || s === "active") return "Em análise";
  if (s === "closed" || s === "completed") return "Concluída";
  if (s === "pending") return "Pendente";
  return "Em análise";
}
