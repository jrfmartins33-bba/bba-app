/**
 * Certificar medição -- orquestra measurement_cycles pelo caminho já
 * definido no banco (create_measurement_cycle → advance_measurement_cycle
 * em sequência draft→measured→bulletin_generated→certified, mais
 * register_measurement_bulletin_line_sources quando o boletim ainda
 * não tem fonte relacional registrada). Nenhuma transição nova é
 * inventada aqui -- as únicas chamadas são as três funções SQL que já
 * existem (migration 20260824231909_measurement_certification_traceability.sql),
 * na única ordem que `advance_measurement_cycle` aceita (cada chamada
 * só avança um passo; o próprio banco rejeita qualquer pulo).
 *
 * REGRA DE SEGURANÇA (rodada de implementação da tela "Revisar
 * medição"): esta função está pronta para uso, mas NÃO deve ser
 * invocada contra o BM_08 real nem contra produção nesta rodada -- a
 * certificação real continua exigindo uma ação explícita e deliberada
 * do usuário na interface, depois de revisar visualmente a tela nova.
 * Os testes deste serviço usam um MeasurementCertificationWriter fake
 * (mock), nunca o service-role client real.
 */

export type MeasurementCertificationCycleStatus = "draft" | "measured" | "bulletin_generated" | "certified" | "closed";

export interface MeasurementCertifyWorkspaceRecord {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
}

export interface MeasurementCertifyBulletinRecord {
  readonly id: string;
  readonly status: "Draft" | "Validated" | "Finalized" | "Cancelled";
}

export interface MeasurementCertifyCycle {
  readonly id: string;
  readonly status: MeasurementCertificationCycleStatus;
  readonly measurementBulletinId: string | null;
}

export interface MeasurementCertifyContractBaseline {
  readonly id: string;
}

export interface MeasurementCertificationReader {
  findWorkspaceByImportId(input: {
    measurementBulletinImportId: string;
    companyId: string;
  }): Promise<MeasurementCertifyWorkspaceRecord | null>;

  findBulletinByWorkspaceId(input: { measurementWorkspaceId: string; companyId: string }): Promise<MeasurementCertifyBulletinRecord | null>;

  findContractBaselineForProject(input: { companyId: string; engineeringProjectId: string }): Promise<MeasurementCertifyContractBaseline | null>;

  findCycleByWorkspaceId(input: { measurementWorkspaceId: string; companyId: string }): Promise<MeasurementCertifyCycle | null>;

  countLineSources(input: { measurementBulletinId: string }): Promise<number>;
}

export interface MeasurementCertificationWriter {
  createMeasurementCycle(params: {
    actorId: string;
    companyId: string;
    engineeringProjectId: string;
    contractBaselineId: string;
    measurementWorkspaceId: string;
    occurredAt: string;
  }): Promise<MeasurementCertifyCycle>;

  advanceMeasurementCycle(params: {
    actorId: string;
    companyId: string;
    measurementCycleId: string;
    toStatus: Exclude<MeasurementCertificationCycleStatus, "draft">;
    occurredAt: string;
    measurementBulletinId?: string;
  }): Promise<MeasurementCertifyCycle>;
}

export type CertifyMeasurementBulletinErrorCode =
  | "workspace_not_found"
  | "bulletin_not_formalized"
  | "bulletin_not_finalized"
  | "contract_baseline_not_found"
  | "already_certified"
  | "line_sources_missing_and_bulletin_already_finalized";

export type CertifyMeasurementBulletinResult =
  | { readonly success: true; readonly certifiedCycle: MeasurementCertifyCycle }
  | { readonly success: false; readonly error: CertifyMeasurementBulletinErrorCode };

export async function certifyMeasurementBulletin(
  input: {
    readonly measurementBulletinImportId: string;
    readonly companyId: string;
    readonly actorId: string;
    /** ISO 8601, injetado pelo chamador -- este serviço nunca chama new Date()/Date.now(). */
    readonly occurredAt: string;
  },
  dependencies: { readonly reader: MeasurementCertificationReader; readonly writer: MeasurementCertificationWriter }
): Promise<CertifyMeasurementBulletinResult> {
  const { reader, writer } = dependencies;

  const workspace = await reader.findWorkspaceByImportId({
    measurementBulletinImportId: input.measurementBulletinImportId,
    companyId: input.companyId
  });
  if (!workspace) {
    return { success: false, error: "workspace_not_found" };
  }

  const bulletin = await reader.findBulletinByWorkspaceId({ measurementWorkspaceId: workspace.id, companyId: input.companyId });
  if (!bulletin) {
    return { success: false, error: "bulletin_not_formalized" };
  }
  if (bulletin.status !== "Finalized") {
    return { success: false, error: "bulletin_not_finalized" };
  }

  const contractBaseline = await reader.findContractBaselineForProject({
    companyId: input.companyId,
    engineeringProjectId: workspace.engineeringProjectId
  });
  if (!contractBaseline) {
    return { success: false, error: "contract_baseline_not_found" };
  }

  let cycle = await reader.findCycleByWorkspaceId({ measurementWorkspaceId: workspace.id, companyId: input.companyId });

  if (cycle === null) {
    cycle = await writer.createMeasurementCycle({
      actorId: input.actorId,
      companyId: input.companyId,
      engineeringProjectId: workspace.engineeringProjectId,
      contractBaselineId: contractBaseline.id,
      measurementWorkspaceId: workspace.id,
      occurredAt: input.occurredAt
    });
  }

  if (cycle.status === "certified" || cycle.status === "closed") {
    return { success: false, error: "already_certified" };
  }

  if (cycle.status === "draft") {
    cycle = await writer.advanceMeasurementCycle({
      actorId: input.actorId,
      companyId: input.companyId,
      measurementCycleId: cycle.id,
      toStatus: "measured",
      occurredAt: input.occurredAt
    });
  }

  if (cycle.status === "measured") {
    // register_measurement_bulletin_line_sources só aceita boletins
    // Draft/Validated (ver migration) -- e este serviço já exigiu
    // bulletin.status === 'Finalized' acima, então registrar fontes
    // aqui nunca é alcançável: um boletim já Finalized sem fontes
    // registradas é um estado permanentemente bloqueado para
    // certificação por este caminho, nunca contornado gravando de
    // qualquer jeito.
    const sourceCount = await reader.countLineSources({ measurementBulletinId: bulletin.id });
    if (sourceCount === 0) {
      return { success: false, error: "line_sources_missing_and_bulletin_already_finalized" };
    }
    cycle = await writer.advanceMeasurementCycle({
      actorId: input.actorId,
      companyId: input.companyId,
      measurementCycleId: cycle.id,
      toStatus: "bulletin_generated",
      occurredAt: input.occurredAt,
      measurementBulletinId: bulletin.id
    });
  }

  if (cycle.status === "bulletin_generated") {
    cycle = await writer.advanceMeasurementCycle({
      actorId: input.actorId,
      companyId: input.companyId,
      measurementCycleId: cycle.id,
      toStatus: "certified",
      occurredAt: input.occurredAt
    });
  }

  return { success: true, certifiedCycle: cycle };
}
