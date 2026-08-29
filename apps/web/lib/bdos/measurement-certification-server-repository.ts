import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Revisar medição" (certificação) -- as três funções SQL que movem
 * measurement_cycles (create_measurement_cycle, advance_measurement_cycle,
 * register_measurement_bulletin_line_sources; migration
 * 20260824231909_measurement_certification_traceability.sql) são
 * SECURITY DEFINER, GRANT EXECUTE só para service_role -- nunca
 * chamáveis pelo cliente RLS-bound. Cada função aqui valida p_actor_id
 * dentro do próprio banco (get_company_id_for_actor/is_bba_admin_actor);
 * este repository nunca reautentica nem reinterpreta o resultado, só
 * chama e devolve/propaga.
 *
 * Nenhuma função deste arquivo é chamada por nenhuma rota nesta
 * rodada -- ver measurement-bulletin-certification-service.ts para a
 * orquestração, e a regra de segurança explícita de não certificar de
 * verdade contra produção nesta rodada.
 */

export type MeasurementCertificationCycleStatus = "draft" | "measured" | "bulletin_generated" | "certified" | "closed";

export interface MeasurementCertificationCycle {
  readonly id: string;
  readonly status: MeasurementCertificationCycleStatus;
  readonly measurementBulletinId: string | null;
}

export interface MeasurementCertificationServerRepository {
  createMeasurementCycle(params: {
    actorId: string;
    companyId: string;
    engineeringProjectId: string;
    contractBaselineId: string;
    measurementWorkspaceId: string;
    occurredAt: string;
  }): Promise<MeasurementCertificationCycle>;

  advanceMeasurementCycle(params: {
    actorId: string;
    companyId: string;
    measurementCycleId: string;
    toStatus: Exclude<MeasurementCertificationCycleStatus, "draft">;
    occurredAt: string;
    measurementBulletinId?: string;
  }): Promise<MeasurementCertificationCycle>;

  registerMeasurementBulletinLineSources(params: {
    actorId: string;
    companyId: string;
    measurementBulletinId: string;
    links: ReadonlyArray<{
      bulletinLineId: string;
      measurementWorkspaceLineId: string;
    }>;
  }): Promise<number>;
}

function toCycle(row: Record<string, unknown>): MeasurementCertificationCycle {
  return {
    id: row.id as string,
    status: row.status as MeasurementCertificationCycleStatus,
    measurementBulletinId: (row.measurement_bulletin_id as string | null) ?? null
  };
}

export function createMeasurementCertificationServerRepository(
  serviceRoleClient: SupabaseClient
): MeasurementCertificationServerRepository {
  return {
    async createMeasurementCycle(params) {
      const { data, error } = await serviceRoleClient.rpc("create_measurement_cycle", {
        p_actor_id: params.actorId,
        p_company_id: params.companyId,
        p_engineering_project_id: params.engineeringProjectId,
        p_contract_baseline_id: params.contractBaselineId,
        p_measurement_workspace_id: params.measurementWorkspaceId,
        p_occurred_at: params.occurredAt
      });
      if (error || !data) {
        throw error ?? new Error("create_measurement_cycle não devolveu o ciclo criado.");
      }
      return toCycle(data as Record<string, unknown>);
    },

    async advanceMeasurementCycle(params) {
      const { data, error } = await serviceRoleClient.rpc("advance_measurement_cycle", {
        p_actor_id: params.actorId,
        p_company_id: params.companyId,
        p_measurement_cycle_id: params.measurementCycleId,
        p_to_status: params.toStatus,
        p_occurred_at: params.occurredAt,
        p_measurement_bulletin_id: params.measurementBulletinId ?? null
      });
      if (error || !data) {
        throw error ?? new Error("advance_measurement_cycle não devolveu o ciclo atualizado.");
      }
      return toCycle(data as Record<string, unknown>);
    },

    async registerMeasurementBulletinLineSources(params) {
      const { data, error } = await serviceRoleClient.rpc("register_measurement_bulletin_line_sources", {
        p_actor_id: params.actorId,
        p_company_id: params.companyId,
        p_measurement_bulletin_id: params.measurementBulletinId,
        p_links: params.links.map((link) => ({
          bulletinLineId: link.bulletinLineId,
          measurementWorkspaceLineId: link.measurementWorkspaceLineId
        }))
      });
      if (error) {
        throw error;
      }
      return Number(data ?? 0);
    }
  };
}
