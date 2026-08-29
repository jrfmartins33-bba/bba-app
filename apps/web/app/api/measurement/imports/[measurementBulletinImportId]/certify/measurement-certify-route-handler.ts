import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedActor } from "@/lib/supabase/server";
import { countMeasurementBulletinLineSources, getMeasurementBulletinByWorkspaceId, getMeasurementCycleByWorkspaceId, getMeasurementWorkspaceByImportId } from "@/lib/bdos/measurement-repository";
import { createContractBaselineRepository } from "@/lib/bdos/contract-baseline-server-repository";
import { createMeasurementCertificationServerRepository } from "@/lib/bdos/measurement-certification-server-repository";
import {
  certifyMeasurementBulletin,
  type MeasurementCertificationReader,
  type MeasurementCertificationWriter
} from "@/lib/bdos/measurement-bulletin-certification-service";

/**
 * Certificar medição — ÚNICA rota que escreve neste conjunto de
 * telas. `route.ts` usa o cliente RLS-bound só para as leituras
 * (workspace/boletim/contrato/ciclo); as três chamadas SQL que
 * avançam measurement_cycles (service-role, SECURITY DEFINER) usam
 * `getSupabaseServiceRoleClient()`, mesma disciplina de
 * budget-official-review-server-repository.ts.
 *
 * REGRA DE SEGURANÇA: esta rota está pronta e testada com dependências
 * fake, mas não deve ser chamada contra o BM_08 real nem produção
 * nesta rodada -- a certificação real exige uma ação explícita e
 * deliberada do usuário na interface, depois de revisar visualmente a
 * tela "Revisar medição".
 */

export function buildMeasurementCertifyReader(supabase: SupabaseClient): MeasurementCertificationReader {
  return {
    async findWorkspaceByImportId(query) {
      const workspace = await getMeasurementWorkspaceByImportId(supabase, {
        measurementBulletinImportId: query.measurementBulletinImportId,
        companyId: query.companyId
      });
      return workspace ? { id: workspace.id, companyId: workspace.companyId, engineeringProjectId: workspace.engineeringProjectId } : null;
    },

    async findBulletinByWorkspaceId(query) {
      const bulletin = await getMeasurementBulletinByWorkspaceId(supabase, {
        measurementWorkspaceId: query.measurementWorkspaceId,
        companyId: query.companyId
      });
      return bulletin ? { id: bulletin.id, status: bulletin.status } : null;
    },

    async findContractBaselineForProject(query) {
      const baseline = await createContractBaselineRepository(supabase).findContractBaselineByProject(query.companyId, query.engineeringProjectId);
      return baseline ? { id: baseline.id } : null;
    },

    async findCycleByWorkspaceId(query) {
      const cycle = await getMeasurementCycleByWorkspaceId(supabase, {
        measurementWorkspaceId: query.measurementWorkspaceId,
        companyId: query.companyId
      });
      return cycle ? { id: cycle.id, status: cycle.status, measurementBulletinId: cycle.measurementBulletinId } : null;
    },

    async countLineSources(query) {
      return countMeasurementBulletinLineSources(supabase, { measurementBulletinId: query.measurementBulletinId });
    }
  };
}

export function buildMeasurementCertifyWriter(serviceRoleClient: SupabaseClient): MeasurementCertificationWriter {
  return createMeasurementCertificationServerRepository(serviceRoleClient);
}

export interface HandlePostMeasurementCertifyInput {
  readonly auth: AuthenticatedActor | null;
  readonly measurementBulletinImportId: string | undefined;
  readonly occurredAt: string;
}

export interface HandlePostMeasurementCertifyDependencies {
  readonly reader: MeasurementCertificationReader;
  readonly writer: MeasurementCertificationWriter;
}

export interface HandlePostMeasurementCertifyOutcome {
  readonly status: number;
  readonly body: unknown;
}

export async function handlePostMeasurementCertify(
  input: HandlePostMeasurementCertifyInput,
  dependencies: HandlePostMeasurementCertifyDependencies
): Promise<HandlePostMeasurementCertifyOutcome> {
  const { auth, measurementBulletinImportId, occurredAt } = input;

  if (!auth) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  if (!measurementBulletinImportId || measurementBulletinImportId.trim().length === 0) {
    return { status: 400, body: { error: "missing_measurement_bulletin_import_id" } };
  }

  // Certificar sempre escreve dentro de UMA empresa -- um bba_admin
  // sem companyId próprio não tem uma organização inequívoca em nome
  // de quem certificar (ao contrário das leituras, que toleram
  // companyId=null e deixam a RLS decidir o escopo).
  if (!auth.companyId) {
    return { status: 409, body: { error: "admin_company_required" } };
  }

  const result = await certifyMeasurementBulletin(
    { measurementBulletinImportId, companyId: auth.companyId, actorId: auth.userId, occurredAt },
    { reader: dependencies.reader, writer: dependencies.writer }
  );

  if (!result.success) {
    const status = result.error === "workspace_not_found" ? 404 : 409;
    return { status, body: { error: result.error } };
  }

  return { status: 200, body: { data: { cycleId: result.certifiedCycle.id, status: result.certifiedCycle.status } } };
}
