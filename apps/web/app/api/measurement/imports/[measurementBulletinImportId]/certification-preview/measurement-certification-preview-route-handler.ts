import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedActor } from "@/lib/supabase/server";
import {
  countMeasurementBulletinLineSources,
  getMeasurementBulletinByWorkspaceId,
  getMeasurementBulletinImportById,
  getMeasurementWorkspaceByImportId,
  listCertifiedMeasurementBulletinTotalsForContractBaseline
} from "@/lib/bdos/measurement-repository";
import { createContractBaselineRepository } from "@/lib/bdos/contract-baseline-server-repository";
import { getMeasurementDecisionBrief, type MeasurementDecisionBriefImportReader } from "@/lib/bdos/measurement-decision-brief-service";
import {
  getMeasurementCertificationPreview,
  type MeasurementCertificationPreviewReader
} from "@/lib/bdos/measurement-bulletin-certification-preview-service";

/**
 * Prévia de certificação — "o usuário precisa entender exatamente o
 * efeito da decisão" antes de confirmar (item 7 da especificação:
 * boletim/período/itens/valor desta medição/acumulado antes/acumulado
 * depois/saldo contratual/responsável/divergências materiais/fontes).
 * Nunca certifica -- leitura pura, mesmo formato route.ts/route-handler.ts.
 */

export function buildMeasurementCertificationPreviewDecisionBriefReader(supabase: SupabaseClient): MeasurementDecisionBriefImportReader {
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

export function buildMeasurementCertificationPreviewReader(supabase: SupabaseClient): MeasurementCertificationPreviewReader {
  const contractBaselineRepository = createContractBaselineRepository(supabase);

  return {
    async findWorkspaceByImportId(query) {
      const workspace = await getMeasurementWorkspaceByImportId(supabase, {
        measurementBulletinImportId: query.measurementBulletinImportId,
        companyId: query.companyId ?? undefined
      });
      return workspace ? { id: workspace.id, companyId: workspace.companyId, engineeringProjectId: workspace.engineeringProjectId } : null;
    },

    async findBulletinByWorkspaceId(query) {
      const bulletin = await getMeasurementBulletinByWorkspaceId(supabase, {
        measurementWorkspaceId: query.measurementWorkspaceId,
        companyId: query.companyId ?? undefined
      });
      if (!bulletin) {
        return null;
      }
      const lines = Array.isArray(bulletin.lines) ? bulletin.lines : [];
      const sourceCount = await countMeasurementBulletinLineSources(supabase, { measurementBulletinId: bulletin.id });
      return {
        id: bulletin.id,
        bulletinNumber: bulletin.bulletinNumber,
        status: bulletin.status,
        header: bulletin.header,
        totals: bulletin.totals,
        lineCount: lines.length,
        sourceCount
      };
    },

    async findContractBaselineForProject(query) {
      const baseline = await contractBaselineRepository.findContractBaselineByProject(query.companyId, query.engineeringProjectId);
      return baseline ? { id: baseline.id, contractedValueCents: baseline.contractedValueCents } : null;
    },

    async listCertifiedBulletinTotalsForContractBaseline(query) {
      return listCertifiedMeasurementBulletinTotalsForContractBaseline(supabase, {
        contractBaselineId: query.contractBaselineId,
        companyId: query.companyId,
        excludingMeasurementBulletinId: query.excludingMeasurementBulletinId
      });
    }
  };
}

export interface HandleGetMeasurementCertificationPreviewInput {
  readonly auth: AuthenticatedActor | null;
  readonly measurementBulletinImportId: string | undefined;
  readonly generatedAt: string;
}

export interface HandleGetMeasurementCertificationPreviewDependencies {
  readonly decisionBriefReader: MeasurementDecisionBriefImportReader;
  readonly previewReader: MeasurementCertificationPreviewReader;
}

export interface HandleGetMeasurementCertificationPreviewOutcome {
  readonly status: number;
  readonly body: unknown;
}

export async function handleGetMeasurementCertificationPreview(
  input: HandleGetMeasurementCertificationPreviewInput,
  dependencies: HandleGetMeasurementCertificationPreviewDependencies
): Promise<HandleGetMeasurementCertificationPreviewOutcome> {
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

  const materialDivergenceCount = decisionBriefResult.decisionBrief.criticalItems.filter((item) => item.materiality === "material").length;

  const previewResult = await getMeasurementCertificationPreview(
    { measurementBulletinImportId, companyId: auth.companyId, materialDivergenceCount },
    { reader: dependencies.previewReader }
  );

  if (!previewResult.success) {
    const status = previewResult.error === "workspace_not_found" ? 404 : 409;
    return { status, body: { error: previewResult.error } };
  }

  return { status: 200, body: { data: previewResult.preview } };
}
