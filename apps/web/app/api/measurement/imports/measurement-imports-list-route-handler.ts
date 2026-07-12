import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedCompany } from "@/lib/supabase/server";
import { listMeasurementBulletinImportsByCompany } from "@/lib/bdos/measurement-repository";
import {
  listMeasurementImports,
  type MeasurementImportListItem,
  type MeasurementImportsListReader
} from "@/lib/bdos/measurement-imports-listing-service";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.1A — orquestração
 * testável da listagem, separada de `route.ts` pelo mesmo motivo já
 * confirmado no 20.1D por `next build` real: arquivos especiais do
 * App Router só podem exportar métodos HTTP e configurações oficiais
 * de segmento.
 */

/**
 * Composição do reader contra o repository real -- mapeia
 * `MeasurementBulletinImportSummary` (forma de persistência) para
 * `MeasurementImportListItem` (forma do Application Service). Vive na
 * fronteira server, nunca no Application Service.
 */
export function buildMeasurementImportsListReader(supabase: SupabaseClient): MeasurementImportsListReader {
  return {
    async listByCompany(query) {
      const summaries = await listMeasurementBulletinImportsByCompany(supabase, { companyId: query.companyId });
      return summaries.map(
        (summary): MeasurementImportListItem => ({
          measurementBulletinImportId: summary.id,
          humanLabel: summary.fileName,
          status: summary.status,
          createdAt: summary.uploadedAt,
          updatedAt: summary.updatedAt,
          analysisAvailable: summary.hasAnalysisResult
        })
      );
    }
  };
}

export interface HandleListMeasurementImportsInput {
  readonly auth: AuthenticatedCompany | null;
}

export interface HandleListMeasurementImportsDependencies {
  readonly importsListReader: MeasurementImportsListReader;
}

export interface HandleListMeasurementImportsOutcome {
  readonly status: number;
  readonly body: unknown;
}

export async function handleListMeasurementImports(
  input: HandleListMeasurementImportsInput,
  dependencies: HandleListMeasurementImportsDependencies
): Promise<HandleListMeasurementImportsOutcome> {
  if (!input.auth) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  const imports = await listMeasurementImports({ companyId: input.auth.companyId }, { importsListReader: dependencies.importsListReader });

  return { status: 200, body: { imports } };
}
