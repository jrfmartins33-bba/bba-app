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
import { getMeasurementDecisionBrief, type MeasurementDecisionBriefImportReader } from "@/lib/bdos/measurement-decision-brief-service";
import { getMeasurementBulletinReview, type MeasurementBulletinReviewReader } from "@/lib/bdos/measurement-bulletin-review-service";
import { buildMeasurementItemEconomicComparisons, normalizeMeasurementItemCode } from "@/lib/bdos/measurement-item-economic-comparison-service";

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
 */

export interface MeasurementEconomicComparisonReader {
  findWorkspaceProjectContext(input: {
    measurementBulletinImportId: string;
    companyId: string | null;
  }): Promise<{ companyId: string; engineeringProjectId: string } | null>;
  /** null quando o contrato não tem uma Proposta Vencedora rastreável (source_budget_version_id ausente). */
  findProposalBudgetVersionId(input: { companyId: string; engineeringProjectId: string }): Promise<string | null>;
  /** null quando a comparação não está disponível (orçamento oficial não rastreável, versão não encontrada etc.) -- nunca um erro para o usuário. */
  getBudgetComparison(input: { companyId: string; proposalBudgetVersionId: string }): Promise<BudgetVersionComparison | null>;
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

  return {
    async findWorkspaceProjectContext(query) {
      const workspace = await getMeasurementWorkspaceByImportId(supabase, {
        measurementBulletinImportId: query.measurementBulletinImportId,
        companyId: query.companyId ?? undefined
      });
      return workspace ? { companyId: workspace.companyId, engineeringProjectId: workspace.engineeringProjectId } : null;
    },

    async findProposalBudgetVersionId(query) {
      const baseline = await contractBaselineRepository.findContractBaselineByProject(query.companyId, query.engineeringProjectId);
      return baseline?.sourceBudgetVersionId ?? null;
    },

    async getBudgetComparison(query) {
      const result = await getBudgetComparisonService(query.companyId, query.proposalBudgetVersionId, budgetVersionRepository);
      return result.outcome === "compared" ? result.comparison : null;
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
  const comparison = await resolveBudgetComparison(measurementBulletinImportId, auth.companyId, dependencies.economicComparisonReader);
  const economicResult = buildMeasurementItemEconomicComparisons(
    reviewResult.review.items.map((item) => ({ code: item.code, quantityDecimal: item.quantityDecimal })),
    comparison
  );

  const items = reviewResult.review.items.map((item) => {
    const normalizedCode = normalizeMeasurementItemCode(item.code);
    const economicComparison = normalizedCode !== null ? (economicResult.byItemCode.get(normalizedCode) ?? null) : null;
    return { ...item, economicComparison };
  });

  return {
    status: 200,
    body: { data: { ...reviewResult.review, items, economicSummary: economicResult.summary } }
  };
}

async function resolveBudgetComparison(
  measurementBulletinImportId: string,
  authCompanyId: string | null,
  reader: MeasurementEconomicComparisonReader
): Promise<BudgetVersionComparison | null> {
  const context = await reader.findWorkspaceProjectContext({ measurementBulletinImportId, companyId: authCompanyId });
  if (!context) {
    return null;
  }
  // bba_admin sem companyId próprio: a comparação econômica é sempre de
  // UMA empresa (mesmo raciocínio já usado na prévia de certificação).
  const effectiveCompanyId = authCompanyId ?? context.companyId;

  const proposalBudgetVersionId = await reader.findProposalBudgetVersionId({
    companyId: effectiveCompanyId,
    engineeringProjectId: context.engineeringProjectId
  });
  if (!proposalBudgetVersionId) {
    return null;
  }

  return reader.getBudgetComparison({ companyId: effectiveCompanyId, proposalBudgetVersionId });
}
