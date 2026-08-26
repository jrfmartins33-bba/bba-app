import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedCompany } from "@/lib/supabase/server";
import {
  countMeasurementBulletinLineSources,
  getMeasurementBulletinByWorkspaceId,
  getMeasurementCycleByWorkspaceId,
  getMeasurementWorkspaceByImportId
} from "@/lib/bdos/measurement-repository";
import {
  getMeasurementBulletinFormalStatus,
  type MeasurementBulletinFormalStatusReader
} from "@/lib/bdos/measurement-bulletin-formal-status-service";

/**
 * Etapa 3C.2 (BM_08) — mesma separação route.ts/route-handler.ts já
 * estabelecida por measurement-decision-brief-route-handler.ts: `route.ts`
 * só pode exportar métodos HTTP/config de segmento, então toda a lógica
 * testável (composição do reader + orquestração) vive aqui.
 */

export function buildMeasurementBulletinFormalStatusReader(supabase: SupabaseClient): MeasurementBulletinFormalStatusReader {
  return {
    async findWorkspaceByImportId(query) {
      const workspace = await getMeasurementWorkspaceByImportId(supabase, {
        measurementBulletinImportId: query.measurementBulletinImportId,
        companyId: query.companyId
      });
      return workspace ? { id: workspace.id } : null;
    },

    async findBulletinByWorkspaceId(query) {
      const bulletin = await getMeasurementBulletinByWorkspaceId(supabase, {
        measurementWorkspaceId: query.measurementWorkspaceId,
        companyId: query.companyId
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

    async countLineSources(query) {
      return countMeasurementBulletinLineSources(supabase, { measurementBulletinId: query.measurementBulletinId });
    },

    async findCycleByWorkspaceId(query) {
      const cycle = await getMeasurementCycleByWorkspaceId(supabase, {
        measurementWorkspaceId: query.measurementWorkspaceId,
        companyId: query.companyId
      });
      return cycle ? { status: cycle.status } : null;
    }
  };
}

export interface HandleGetMeasurementBulletinFormalStatusInput {
  readonly auth: AuthenticatedCompany | null;
  readonly measurementBulletinImportId: string | undefined;
}

export interface HandleGetMeasurementBulletinFormalStatusDependencies {
  readonly reader: MeasurementBulletinFormalStatusReader;
}

export interface HandleGetMeasurementBulletinFormalStatusOutcome {
  readonly status: number;
  readonly body: unknown;
}

export async function handleGetMeasurementBulletinFormalStatus(
  input: HandleGetMeasurementBulletinFormalStatusInput,
  dependencies: HandleGetMeasurementBulletinFormalStatusDependencies
): Promise<HandleGetMeasurementBulletinFormalStatusOutcome> {
  const { auth, measurementBulletinImportId } = input;

  if (!auth) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  if (!measurementBulletinImportId || measurementBulletinImportId.trim().length === 0) {
    return { status: 400, body: { error: "missing_measurement_bulletin_import_id" } };
  }

  const result = await getMeasurementBulletinFormalStatus(
    { measurementBulletinImportId, companyId: auth.companyId },
    { reader: dependencies.reader }
  );

  if (!result.success) {
    // Mesmo mapeamento de decision-brief: recurso inexistente (ou de
    // outro tenant, indistinguível) -> 404; recurso existe mas ainda
    // não chegou ao estado necessário (nenhum boletim formal ainda) -> 409.
    const status = result.error === "workspace_not_found" ? 404 : 409;
    return { status, body: { error: result.error } };
  }

  return { status: 200, body: { data: result.formalStatus } };
}
