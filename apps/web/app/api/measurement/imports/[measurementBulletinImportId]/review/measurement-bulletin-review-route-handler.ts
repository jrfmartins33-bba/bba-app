import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedActor } from "@/lib/supabase/server";
import {
  countMeasurementBulletinLineSources,
  getMeasurementBulletinByWorkspaceId,
  getMeasurementBulletinImportById,
  getMeasurementCycleByWorkspaceId,
  getMeasurementWorkspaceByImportId,
  listMeasurementBulletinLineSources,
  listMeasurementWorkspaceLines
} from "@/lib/bdos/measurement-repository";
import { getMeasurementDecisionBrief, type MeasurementDecisionBriefImportReader } from "@/lib/bdos/measurement-decision-brief-service";
import { getMeasurementBulletinReview, type MeasurementBulletinReviewReader } from "@/lib/bdos/measurement-bulletin-review-service";

/**
 * "Revisar medição" — mesma separação route.ts/route-handler.ts das
 * demais rotas de measurement/imports. Compõe DUAS leituras: o
 * DecisionBrief já existente (só para reaproveitar `criticalItems` —
 * a classificação material/observação técnica já aprovada, nunca
 * recalculada aqui) e o novo MeasurementBulletinReview (header/itens
 * do boletim formal).
 */

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

  return { status: 200, body: { data: reviewResult.review } };
}
