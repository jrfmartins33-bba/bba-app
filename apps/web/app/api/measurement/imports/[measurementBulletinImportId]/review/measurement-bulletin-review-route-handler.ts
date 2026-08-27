import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedActor } from "@/lib/supabase/server";
import type { BudgetVersionComparison } from "@bba/bdos-core/services/procurement-engineering";
import { getBudgetComparisonService } from "@bba/bdos-core/services/procurement-engineering";
import {
  countMeasurementBulletinLineSources,
  getMeasurementBulletinByWorkspaceId,
  getMeasurementBulletinImportById,
  getMeasurementCycleByWorkspaceId,
  getMeasurementWorkspaceByImportId,
  listMeasurementBulletinLineSources,
  listMeasurementWorkspaceLines
} from "@/lib/bdos/measurement-repository";
import { createContractBaselineRepository } from "@/lib/bdos/contract-baseline-server-repository";
import { createBudgetVersionRepository } from "@/lib/bdos/procurement-engineering-server-repository";
import { createContractExecutionItemTraceabilityRepository } from "@/lib/bdos/contract-execution-item-link-server-repository";
import { getMeasurementDecisionBrief, type MeasurementDecisionBriefImportReader } from "@/lib/bdos/measurement-decision-brief-service";
import { getMeasurementBulletinReview, type MeasurementBulletinReviewReader } from "@/lib/bdos/measurement-bulletin-review-service";
import { buildMeasurementItemEconomicComparisons, compareMoneyDecimalsDescending } from "@/lib/bdos/measurement-item-economic-comparison-service";

/**
 * "Revisar medição" — mesma separação route.ts/route-handler.ts das
 * demais rotas de measurement/imports. Compõe TRÊS leituras: o
 * DecisionBrief já existente (só para reaproveitar `criticalItems` —
 * a classificação material/observação técnica já aprovada, nunca
 * recalculada aqui), o MeasurementBulletinReview (header/itens do
 * boletim formal) e, evolução desta rodada, a referência econômica
 * (Orçamento Oficial × Proposta Vencedora) via o mesmo motor já usado
 * e testado por /orcamentos (getBudgetComparisonService) -- nunca uma
 * segunda implementação de comparação.
 *
 * CORREÇÃO CIRÚRGICA (pós-Preview): a ligação entre item medido e
 * item comparado agora usa PRIMARIAMENTE a identidade já persistida em
 * contract_execution_item_links (managed_service_item_id ->
 * proposal_budget_line_id) -- nunca mais dependendo exclusivamente do
 * texto do código, que vive em dois espaços de código independentes
 * (ver measurement-item-economic-comparison-service.ts para a causa
 * raiz completa, confirmada contra o BM_08 real).
 */

export interface MeasurementEconomicComparisonReader {
  findWorkspaceProjectContext(input: {
    measurementBulletinImportId: string;
    companyId: string | null;
  }): Promise<{ companyId: string; engineeringProjectId: string } | null>;
  /** null quando o projeto não tem contrato rastreável ou o contrato não tem Proposta Vencedora rastreável (source_budget_version_id ausente). */
  findContractBaseline(input: {
    companyId: string;
    engineeringProjectId: string;
  }): Promise<{ id: string; sourceBudgetVersionId: string } | null>;
  /** null quando a comparação não está disponível (orçamento oficial não rastreável, versão não encontrada etc.) -- nunca um erro para o usuário. */
  getBudgetComparison(input: { companyId: string; proposalBudgetVersionId: string }): Promise<BudgetVersionComparison | null>;
  /** managed_service_item_id -> proposal_budget_line_id, de contract_execution_item_links -- identidade persistida, sempre preferida ao código de texto. */
  findExecutionItemLinks(input: { companyId: string; contractBaselineId: string }): Promise<ReadonlyMap<string, string>>;
}

export function buildMeasurementReviewDecisionBriefReader(supabase: SupabaseClient): MeasurementDecisionBriefImportReader {
  return {
    async findById(query) {
      const record = await getMeasurementBulletinImportById(supabase, {
        id: query.measurementBulletinImportId,
        companyId: query.companyId ?? undefined
      });
      return record ? { analysisResult: record.analysisResult } : null;
    }
  };
}

export function buildMeasurementEconomicComparisonReader(supabase: SupabaseClient): MeasurementEconomicComparisonReader {
  const contractBaselineRepository = createContractBaselineRepository(supabase);
  const budgetVersionRepository = createBudgetVersionRepository(supabase);
  const executionItemLinkRepository = createContractExecutionItemTraceabilityRepository(supabase);

  return {
    async findWorkspaceProjectContext(query) {
      const workspace = await getMeasurementWorkspaceByImportId(supabase, {
        measurementBulletinImportId: query.measurementBulletinImportId,
        companyId: query.companyId ?? undefined
      });
      return workspace ? { companyId: workspace.companyId, engineeringProjectId: workspace.engineeringProjectId } : null;
    },

    async findContractBaseline(query) {
      const baseline = await contractBaselineRepository.findContractBaselineByProject(query.companyId, query.engineeringProjectId);
      if (!baseline || !baseline.sourceBudgetVersionId) {
        return null;
      }
      return { id: baseline.id, sourceBudgetVersionId: baseline.sourceBudgetVersionId };
    },

    async getBudgetComparison(query) {
      const result = await getBudgetComparisonService(query.companyId, query.proposalBudgetVersionId, budgetVersionRepository);
      return result.outcome === "compared" ? result.comparison : null;
    },

    async findExecutionItemLinks(query) {
      const rows = await executionItemLinkRepository.listByContractBaseline(query.companyId, query.contractBaselineId);
      const links = new Map<string, string>();
      for (const row of rows as ReadonlyArray<Record<string, unknown>>) {
        const managedServiceItemId = row.managed_service_item_id;
        const proposalBudgetLineId = row.proposal_budget_line_id;
        if (typeof managedServiceItemId === "string" && typeof proposalBudgetLineId === "string") {
          links.set(managedServiceItemId, proposalBudgetLineId);
        }
      }
      return links;
    }
  };
}

export function buildMeasurementBulletinReviewReader(supabase: SupabaseClient): MeasurementBulletinReviewReader {
  return {
    async findWorkspaceByImportId(query) {
      const workspace = await getMeasurementWorkspaceByImportId(supabase, {
        measurementBulletinImportId: query.measurementBulletinImportId,
        companyId: query.companyId ?? undefined
      });
      return workspace ? { id: workspace.id } : null;
    },

    async findBulletinByWorkspaceId(query) {
      const bulletin = await getMeasurementBulletinByWorkspaceId(supabase, {
        measurementWorkspaceId: query.measurementWorkspaceId,
        companyId: query.companyId ?? undefined
      });
      if (!bulletin) {
        return null;
      }
      return {
        id: bulletin.id,
        bulletinNumber: bulletin.bulletinNumber,
        status: bulletin.status,
        header: bulletin.header,
        totals: bulletin.totals,
        lines: bulletin.lines
      };
    },

    async listWorkspaceLines(query) {
      const lines = await listMeasurementWorkspaceLines(supabase, { measurementWorkspaceId: query.measurementWorkspaceId });
      return lines.map((line) => ({
        id: line.id,
        sourceSheetName: line.sourceSheetName,
        sourceRowNumber: line.sourceRowNumber,
        sourcePhysicalColumn: line.sourcePhysicalColumn,
        sourceFinancialColumn: line.sourceFinancialColumn
      }));
    },

    async listLineSources(query) {
      return listMeasurementBulletinLineSources(supabase, { measurementBulletinId: query.measurementBulletinId });
    },

    async findCycleByWorkspaceId(query) {
      const cycle = await getMeasurementCycleByWorkspaceId(supabase, {
        measurementWorkspaceId: query.measurementWorkspaceId,
        companyId: query.companyId ?? undefined
      });
      return cycle ? { status: cycle.status } : null;
    }
  };
}

export interface HandleGetMeasurementBulletinReviewInput {
  readonly auth: AuthenticatedActor | null;
  readonly measurementBulletinImportId: string | undefined;
  readonly generatedAt: string;
}

export interface HandleGetMeasurementBulletinReviewDependencies {
  readonly decisionBriefReader: MeasurementDecisionBriefImportReader;
  readonly reviewReader: MeasurementBulletinReviewReader;
  readonly economicComparisonReader: MeasurementEconomicComparisonReader;
}

export interface HandleGetMeasurementBulletinReviewOutcome {
  readonly status: number;
  readonly body: unknown;
}

export async function handleGetMeasurementBulletinReview(
  input: HandleGetMeasurementBulletinReviewInput,
  dependencies: HandleGetMeasurementBulletinReviewDependencies
): Promise<HandleGetMeasurementBulletinReviewOutcome> {
  const { auth, measurementBulletinImportId, generatedAt } = input;

  if (!auth) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  if (!measurementBulletinImportId || measurementBulletinImportId.trim().length === 0) {
    return { status: 400, body: { error: "missing_measurement_bulletin_import_id" } };
  }

  const decisionBriefResult = await getMeasurementDecisionBrief(
    { measurementBulletinImportId, companyId: auth.companyId, generatedAt },
    { importReader: dependencies.decisionBriefReader }
  );

  if (!decisionBriefResult.success) {
    const status = decisionBriefResult.error === "import_not_found" ? 404 : 409;
    return { status, body: { error: decisionBriefResult.error } };
  }

  const reviewResult = await getMeasurementBulletinReview(
    {
      measurementBulletinImportId,
      companyId: auth.companyId,
      criticalItems: decisionBriefResult.decisionBrief.criticalItems
    },
    { reader: dependencies.reviewReader }
  );

  if (!reviewResult.success) {
    const status = reviewResult.error === "workspace_not_found" ? 404 : 409;
    return { status, body: { error: reviewResult.error } };
  }

  // Referência econômica (Orçamento Oficial × Proposta Vencedora) --
  // sempre melhor-esforço: qualquer ausência (sem contrato rastreável,
  // sem Proposta Vencedora, sem Orçamento Oficial de origem) resulta
  // em economicSummary=null / economicComparison=null por item, nunca
  // um erro para o usuário nem uma comparação inventada.
  const { comparison, executionItemLinks } = await resolveEconomicComparisonInputs(
    measurementBulletinImportId,
    auth.companyId,
    dependencies.economicComparisonReader
  );
  const economicResult = buildMeasurementItemEconomicComparisons(
    reviewResult.review.items.map((item) => ({
      id: item.id,
      code: item.code,
      quantityDecimal: item.quantityDecimal,
      managedServiceItemId: item.managedServiceItemId
    })),
    comparison,
    executionItemLinks
  );

  const items = reviewResult.review.items.map((item) => ({
    ...item,
    economicComparison: economicResult.byItemId.get(item.id) ?? null
  }));

  // "Ver composição" (item 5) -- os itens que realmente têm
  // correspondência, com o que a UI precisa para explicar de onde vem
  // o impacto agregado (código/descrição/quantidade já vêm do
  // boletim; o resto vem do próprio economicComparison, nunca
  // recalculado aqui). Ordenado pela maior contribuição -- decisão do
  // servidor, a UI nunca reordena.
  const composition = items
    .filter((item): item is typeof item & { economicComparison: NonNullable<(typeof item)["economicComparison"]> } => item.economicComparison !== null)
    .map((item) => ({
      itemId: item.id,
      code: item.code,
      description: item.description,
      quantityDecimal: item.quantityDecimal,
      officialUnitPriceDecimal: item.economicComparison.officialUnitPriceDecimal,
      contractedUnitPriceDecimal: item.economicComparison.contractedUnitPriceDecimal,
      lineImpactDecimal: item.economicComparison.lineImpactDecimal,
      participationPercentage: item.economicComparison.participationPercentage
    }))
    .sort((a, b) => compareMoneyDecimalsDescending(a.lineImpactDecimal, b.lineImpactDecimal));

  const economicSummary = economicResult.summary ? { ...economicResult.summary, composition } : null;

  return {
    status: 200,
    body: { data: { ...reviewResult.review, items, economicSummary } }
  };
}

async function resolveEconomicComparisonInputs(
  measurementBulletinImportId: string,
  authCompanyId: string | null,
  reader: MeasurementEconomicComparisonReader
): Promise<{ comparison: BudgetVersionComparison | null; executionItemLinks: ReadonlyMap<string, string> }> {
  const NONE = { comparison: null, executionItemLinks: new Map<string, string>() };

  const context = await reader.findWorkspaceProjectContext({ measurementBulletinImportId, companyId: authCompanyId });
  if (!context) {
    return NONE;
  }
  // bba_admin sem companyId próprio: a comparação econômica é sempre de
  // UMA empresa (mesmo raciocínio já usado na prévia de certificação).
  const effectiveCompanyId = authCompanyId ?? context.companyId;

  const baseline = await reader.findContractBaseline({ companyId: effectiveCompanyId, engineeringProjectId: context.engineeringProjectId });
  if (!baseline) {
    return NONE;
  }

  const [comparison, executionItemLinks] = await Promise.all([
    reader.getBudgetComparison({ companyId: effectiveCompanyId, proposalBudgetVersionId: baseline.sourceBudgetVersionId }),
    reader.findExecutionItemLinks({ companyId: effectiveCompanyId, contractBaselineId: baseline.id })
  ]);

  return { comparison, executionItemLinks };
}
