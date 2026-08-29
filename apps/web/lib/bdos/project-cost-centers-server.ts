import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildProjectCostCentersReadModel,
  formatCostCenterPeriodLabel,
  isYearMonth,
  pickDefaultCostCenterPeriod,
  CostAllocationMethod,
  CostDataNature,
  CostEntrySourceKind,
  CostEntryStatus,
  CostFamily,
  type ProjectCostAllocation,
  type ProjectCostCentersReadModel,
  type ProjectCostEntry,
  type ReadModelCostCenterInput,
  type ReadModelEntryInput,
} from "@bba/bdos-core/domain/cost-center";
import {
  createConsortiumRepository,
  createContractBaselineRepository,
  createCostCenterRepository,
} from "./contract-baseline-server-repository";

/**
 * Orquestração server-side do read model de Centros de Custo — Camada
 * Operacional. Somente leitura. Nunca escreve. Reúne:
 *   - project_cost_centers (já existentes);
 *   - consórcio + participação societária (contract_baselines → consortia);
 *   - project_cost_entries / project_cost_allocations do período (quando a
 *     migration da camada operacional já tiver sido aplicada — caso
 *     contrário degrada com segurança para "não materializado", sem 500);
 *   - a medição formal do período, quando localizável deterministicamente,
 *     para a comparação NEUTRA "valor medido × custos demonstrativos".
 *
 * O cálculo é 100% do domínio (buildProjectCostCentersReadModel).
 */

/** Reexport para as rotas — validação/rotulagem de período vivem no domínio. */
export const isValidYearMonth = isYearMonth;
export const formatPeriodLabelPtBr = formatCostCenterPeriodLabel;

/** "YYYY-MM" do boletim de medição formal mais recente da obra, ou null. */
async function findLatestBulletinPeriod(
  queryClient: SupabaseClient,
  params: { organizationId: string; projectId: string },
): Promise<string | null> {
  const { data, error } = await queryClient
    .from("measurement_bulletins")
    .select("header, created_at")
    .eq("company_id", params.organizationId)
    .eq("engineering_project_id", params.projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const header = (data.header as Record<string, unknown> | null) ?? {};
  const start = typeof header.startDate === "string" ? header.startDate : null;
  const match = start ? /^(\d{4})-(\d{2})/.exec(start) : null;
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Períodos "YYYY-MM" distintos que possuem custos registrados nesta obra. [] se a tabela ainda não existe. */
export async function listCostEntryPeriods(
  queryClient: SupabaseClient,
  params: { organizationId: string; projectId: string },
): Promise<ReadonlyArray<string>> {
  const { data, error } = await queryClient
    .from("project_cost_entries")
    .select("competence_period")
    .eq("company_id", params.organizationId)
    .eq("engineering_project_id", params.projectId);

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  const periods = new Set<string>();
  for (const row of (data ?? []) as Array<{ competence_period: string | null }>) {
    if (isYearMonth(row.competence_period)) periods.add(row.competence_period);
  }
  return [...periods];
}

/**
 * Período gerencial default. Prioridade:
 *   CUSTO REGISTRADO  >  MEDIÇÃO FORMAL  >  MÊS CORRENTE.
 * A medição é base da COMPARAÇÃO gerencial, não do período da tela de custos.
 */
export async function resolveDefaultCostCenterPeriod(
  queryClient: SupabaseClient,
  params: { organizationId: string; projectId: string },
): Promise<string> {
  const [costEntryPeriods, latestBulletinPeriod] = await Promise.all([
    listCostEntryPeriods(queryClient, params),
    findLatestBulletinPeriod(queryClient, params),
  ]);
  return pickDefaultCostCenterPeriod({
    costEntryPeriods,
    latestBulletinPeriod,
    currentYearMonth: new Date().toISOString().slice(0, 7),
  });
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

/** "YYYY-MM" a partir de "YYYY-MM-DD". */
function toYearMonth(dateLike: string | null | undefined): string | null {
  if (!dateLike) return null;
  const match = /^(\d{4})-(\d{2})/.exec(dateLike);
  return match ? `${match[1]}-${match[2]}` : null;
}

interface CostEntryRow {
  id: string;
  company_id: string;
  engineering_project_id: string;
  financial_lancamento_id: string | null;
  financial_categoria_id: string | null;
  cost_family: string;
  description: string;
  supplier_name: string | null;
  amount_decimal: string | number;
  competence_period: string;
  data_nature: string;
  source_kind: string;
  source_record_key: string | null;
  status: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

interface CostAllocationRow {
  id: string;
  company_id: string;
  engineering_project_id: string;
  project_cost_entry_id: string;
  project_cost_center_id: string;
  allocation_method: string;
  allocation_basis_points: number;
  allocated_amount_decimal: string | number;
  rationale: string | null;
}

function mapCostFamily(raw: string): CostFamily {
  switch (raw) {
    case "RH":
      return CostFamily.RH;
    case "Combustivel":
      return CostFamily.Combustivel;
    case "LocacaoEquipamentos":
      return CostFamily.LocacaoEquipamentos;
    default:
      return CostFamily.Outros;
  }
}

function mapMethod(raw: string): CostAllocationMethod {
  switch (raw) {
    case "EQUAL_SPLIT":
      return CostAllocationMethod.EqualSplit;
    case "CUSTOM_SPLIT":
      return CostAllocationMethod.CustomSplit;
    default:
      return CostAllocationMethod.Direct;
  }
}

export interface LoadProjectCostCentersInput {
  readonly organizationId: string;
  readonly projectId: string;
  /** "YYYY-MM". Default: período gerencial corrente definido pelo chamador. */
  readonly period: string;
  /** Demonstrative por padrão nesta primeira demonstração da funcionalidade. */
  readonly dataNature?: CostDataNature;
}

export async function loadProjectCostCentersReadModel(
  queryClient: SupabaseClient,
  input: LoadProjectCostCentersInput,
): Promise<ProjectCostCentersReadModel | null> {
  const { organizationId, projectId, period } = input;
  const dataNature = input.dataNature ?? CostDataNature.Demonstrative;

  const { data: project, error: projectError } = await queryClient
    .from("engineering_projects")
    .select("id, name")
    .eq("company_id", organizationId)
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    return null;
  }

  const baselineRepo = createContractBaselineRepository(queryClient);
  const consortiumRepo = createConsortiumRepository(queryClient);
  const costCenterRepo = createCostCenterRepository(queryClient);

  // 1. Centros de Custo já persistidos + consórcio (participação societária).
  const [costCenters, baseline] = await Promise.all([
    costCenterRepo.listCostCentersByProject(organizationId, projectId),
    baselineRepo.findContractBaselineByProject(organizationId, projectId),
  ]);

  const consortium = baseline?.consortiumId
    ? await consortiumRepo.findConsortiumById(organizationId, baseline.consortiumId)
    : null;

  const shareByMemberId = new Map<string, number>();
  const nameByMemberId = new Map<string, string>();
  for (const member of consortium?.members ?? []) {
    shareByMemberId.set(member.id, member.shareBasisPoints);
    nameByMemberId.set(member.id, member.partyTradeNameSnapshot || member.partyNameSnapshot);
  }

  const readModelCostCenters: ReadModelCostCenterInput[] = costCenters.map((cc) => ({
    id: cc.id,
    organizationId,
    engineeringProjectId: projectId,
    code: cc.code,
    name: cc.name,
    consortiumMemberId: cc.consortiumMemberId,
    consortiumMemberName: cc.consortiumMemberId ? nameByMemberId.get(cc.consortiumMemberId) ?? null : null,
    consortiumShareBasisPoints: cc.consortiumMemberId
      ? shareByMemberId.get(cc.consortiumMemberId) ?? null
      : null,
  }));

  // 2. Camada operacional (custos + alocações). Se a migration ainda não
  //    foi aplicada, degrada com segurança para "não materializado".
  let operationalLayerMaterialized = true;
  const costEntries: ReadModelEntryInput[] = [];

  const entriesResult = await queryClient
    .from("project_cost_entries")
    .select(
      "id, company_id, engineering_project_id, financial_lancamento_id, financial_categoria_id, cost_family, description, supplier_name, amount_decimal, competence_period, data_nature, source_kind, source_record_key, status, notes, metadata",
    )
    .eq("company_id", organizationId)
    .eq("engineering_project_id", projectId)
    .eq("competence_period", period)
    .eq("data_nature", dataNature);

  if (entriesResult.error) {
    if (isMissingRelationError(entriesResult.error)) {
      operationalLayerMaterialized = false;
    } else {
      throw entriesResult.error;
    }
  }

  const entryRows = (entriesResult.data ?? []) as CostEntryRow[];

  if (operationalLayerMaterialized && entryRows.length > 0) {
    const entryIds = entryRows.map((r) => r.id);
    const allocationsResult = await queryClient
      .from("project_cost_allocations")
      .select(
        "id, company_id, engineering_project_id, project_cost_entry_id, project_cost_center_id, allocation_method, allocation_basis_points, allocated_amount_decimal, rationale",
      )
      .eq("company_id", organizationId)
      .in("project_cost_entry_id", entryIds);

    if (allocationsResult.error) {
      if (isMissingRelationError(allocationsResult.error)) {
        operationalLayerMaterialized = false;
      } else {
        throw allocationsResult.error;
      }
    }

    const allocationRows = (allocationsResult.data ?? []) as CostAllocationRow[];
    const categoryLabelById = await loadCategoryLabels(
      queryClient,
      entryRows.map((r) => r.financial_categoria_id).filter((id): id is string => id !== null),
    );

    const allocationsByEntryId = new Map<string, ProjectCostAllocation[]>();
    for (const row of allocationRows) {
      const list = allocationsByEntryId.get(row.project_cost_entry_id) ?? [];
      list.push({
        id: row.id,
        organizationId: row.company_id,
        engineeringProjectId: row.engineering_project_id,
        projectCostEntryId: row.project_cost_entry_id,
        projectCostCenterId: row.project_cost_center_id,
        allocationMethod: mapMethod(row.allocation_method),
        allocationBasisPoints: row.allocation_basis_points,
        allocatedAmountDecimal: String(row.allocated_amount_decimal),
        rationale: row.rationale,
      });
      allocationsByEntryId.set(row.project_cost_entry_id, list);
    }

    for (const row of entryRows) {
      const entry: ProjectCostEntry = {
        id: row.id,
        organizationId: row.company_id,
        engineeringProjectId: row.engineering_project_id,
        financialLancamentoId: row.financial_lancamento_id,
        financialCategoriaId: row.financial_categoria_id,
        categoryLabel: row.financial_categoria_id
          ? categoryLabelById.get(row.financial_categoria_id) ?? null
          : null,
        costFamily: mapCostFamily(row.cost_family),
        description: row.description,
        supplierName: row.supplier_name,
        amountDecimal: String(row.amount_decimal),
        competencePeriod: row.competence_period,
        dataNature: row.data_nature === "Actual" ? CostDataNature.Actual : CostDataNature.Demonstrative,
        sourceKind: (Object.values(CostEntrySourceKind) as string[]).includes(row.source_kind)
          ? (row.source_kind as CostEntrySourceKind)
          : CostEntrySourceKind.ManualControlled,
        sourceRecordKey: row.source_record_key,
        status: row.status === "Allocated" ? CostEntryStatus.Allocated : CostEntryStatus.Draft,
        notes: row.notes,
        metadata: row.metadata ?? {},
      };
      costEntries.push({ entry, allocations: allocationsByEntryId.get(row.id) ?? [] });
    }
  }

  // 3. Medição formal do período (reutiliza a infraestrutura existente)
  //    + períodos com custos (para o seletor).
  const [measurementComparison, availablePeriods] = await Promise.all([
    resolveMeasurementComparison(queryClient, { organizationId, projectId, period }),
    listCostEntryPeriods(queryClient, { organizationId, projectId }),
  ]);

  return buildProjectCostCentersReadModel({
    organizationId,
    engineeringProjectId: projectId,
    projectName: project.name ?? null,
    period,
    periodLabel: formatPeriodLabelPtBr(period),
    availablePeriods,
    dataNature,
    costCenters: readModelCostCenters,
    costEntries,
    operationalLayerMaterialized,
    measurementComparison,
  });
}

async function loadCategoryLabels(
  queryClient: SupabaseClient,
  categoryIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (categoryIds.length === 0) return labels;
  const { data } = await queryClient
    .from("financial_categorias")
    .select("id, nome")
    .in("id", Array.from(new Set(categoryIds)));
  for (const row of (data ?? []) as Array<{ id: string; nome: string }>) {
    labels.set(row.id, row.nome);
  }
  return labels;
}

interface ResolveMeasurementComparisonInput {
  readonly organizationId: string;
  readonly projectId: string;
  readonly period: string;
}

/**
 * Localiza DETERMINISTICAMENTE a medição formal do período. Só devolve
 * `available: true` quando existe exatamente um boletim formal cujo
 * período cobre o mês pedido. Nada é inventado; sem correspondência
 * segura → indisponível.
 */
async function resolveMeasurementComparison(
  queryClient: SupabaseClient,
  input: ResolveMeasurementComparisonInput,
): Promise<{ available: boolean; measuredValueDecimal: string | null; measurementLabel: string | null }> {
  const unavailable = { available: false, measuredValueDecimal: null, measurementLabel: null };

  const { data, error } = await queryClient
    .from("measurement_bulletins")
    .select("id, bulletin_number, period_number, header, totals, status")
    .eq("company_id", input.organizationId)
    .eq("engineering_project_id", input.projectId);

  if (error || !data) {
    return unavailable;
  }

  const matches = (data as Array<Record<string, unknown>>).filter((row) => {
    const header = (row.header as Record<string, unknown> | null) ?? {};
    const startYm = toYearMonth(typeof header.startDate === "string" ? header.startDate : null);
    const endYm = toYearMonth(typeof header.endDate === "string" ? header.endDate : null);
    if (startYm && endYm) {
      return input.period >= startYm && input.period <= endYm;
    }
    if (startYm) {
      return input.period === startYm;
    }
    return false;
  });

  if (matches.length !== 1) {
    return unavailable;
  }

  const match = matches[0];
  const totals = (match.totals as Record<string, unknown> | null) ?? {};
  const canonicalTotalValue =
    typeof totals.canonicalTotalValue === "string"
      ? totals.canonicalTotalValue
      : typeof totals.totalValue === "string"
        ? totals.totalValue
        : null;

  if (!canonicalTotalValue) {
    return unavailable;
  }

  const bulletinNumber = typeof match.bulletin_number === "number" ? match.bulletin_number : null;
  const label = bulletinNumber
    ? `BM ${String(bulletinNumber).padStart(2, "0")} · ${formatPeriodLabelPtBr(input.period)}`
    : `Medição de ${formatPeriodLabelPtBr(input.period)}`;

  return { available: true, measuredValueDecimal: canonicalTotalValue, measurementLabel: label };
}
