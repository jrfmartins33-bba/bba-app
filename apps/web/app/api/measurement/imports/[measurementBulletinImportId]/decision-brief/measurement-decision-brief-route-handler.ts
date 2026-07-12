import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedCompany } from "@/lib/supabase/server";
import { getMeasurementBulletinImportById } from "@/lib/bdos/measurement-repository";
import { getMeasurementDecisionBrief, type MeasurementDecisionBriefImportReader } from "@/lib/bdos/measurement-decision-brief-service";

/**
 * Epic 20 (Decision Experience), Sprint 20.1D — orquestração
 * testável da Delivery Boundary, separada de `route.ts` de propósito:
 * arquivos especiais do App Router (`route.ts`) só podem exportar
 * métodos HTTP e as poucas configurações oficiais de segmento --
 * qualquer outro export quebra `next build` (confirmado nesta Sprint,
 * `next build` real, Next.js 14.2.23: "Property
 * 'buildMeasurementDecisionBriefImportReader' is incompatible with
 * index signature"). Este arquivo existe para que a lógica seja
 * testável sem violar essa restrição.
 */

/**
 * Composição do reader contra o repository real -- única linha de
 * mapeamento entre `MeasurementBulletinImportRecord` (modelo de
 * persistência completo) e `MeasurementDecisionBriefImportRecord`
 * (só o campo que o Application Service usa). Vive na fronteira
 * server, nunca no Application Service.
 */
export function buildMeasurementDecisionBriefImportReader(supabase: SupabaseClient): MeasurementDecisionBriefImportReader {
  return {
    async findById(query) {
      const record = await getMeasurementBulletinImportById(supabase, { id: query.measurementBulletinImportId, companyId: query.companyId });
      if (!record) {
        return null;
      }
      return { analysisResult: record.analysisResult };
    }
  };
}

export interface HandleGetMeasurementDecisionBriefInput {
  readonly auth: AuthenticatedCompany | null;
  readonly measurementBulletinImportId: string | undefined;
  readonly generatedAt: string;
}

export interface HandleGetMeasurementDecisionBriefDependencies {
  readonly importReader: MeasurementDecisionBriefImportReader;
}

export interface HandleGetMeasurementDecisionBriefOutcome {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Orquestração testável, desacoplada de `next/server`/`cookies()` --
 * devolve `{status, body}` puros, nunca um `NextResponse`. `GET`
 * (route.ts) só embrulha isso.
 */
export async function handleGetMeasurementDecisionBrief(
  input: HandleGetMeasurementDecisionBriefInput,
  dependencies: HandleGetMeasurementDecisionBriefDependencies
): Promise<HandleGetMeasurementDecisionBriefOutcome> {
  const { auth, measurementBulletinImportId, generatedAt } = input;

  if (!auth) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  if (!measurementBulletinImportId || measurementBulletinImportId.trim().length === 0) {
    return { status: 400, body: { error: "missing_measurement_bulletin_import_id" } };
  }

  const result = await getMeasurementDecisionBrief(
    { measurementBulletinImportId, companyId: auth.companyId, generatedAt },
    { importReader: dependencies.importReader }
  );

  if (!result.success) {
    // Mesmo mapeamento já usado por bba-project/imports/process/route.ts:
    // recurso inexistente (ou de outro tenant, indistinguível) -> 404;
    // recurso existe mas ainda não está no estado necessário -> 409.
    const status = result.error === "import_not_found" ? 404 : 409;
    return { status, body: { error: result.error } };
  }

  return { status: 200, body: { data: result.decisionBrief } };
}
