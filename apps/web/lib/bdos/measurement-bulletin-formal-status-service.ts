/**
 * Etapa 3C.2 (BM_08) — Application Service somente leitura para o
 * estado formal já persistido de um boletim de medição (envelope
 * completo da Etapa 3C.1C: reference/header/decimal_context/trace,
 * mais as fontes relacionais e o ciclo de medição). Nunca calcula,
 * nunca formaliza, nunca certifica -- só projeta o que já está
 * persistido em uma forma pronta para a tela. Mesma disciplina de
 * measurement-imports-listing-service.ts: reader injetado, nenhuma
 * dependência direta de SupabaseClient.
 */

export type MeasurementBulletinFormalStatusValue =
  | "Draft"
  | "Validated"
  | "Finalized"
  | "Cancelled";

export interface MeasurementBulletinFormalStatus {
  readonly bulletinNumber: number;
  readonly periodStartDate: string;
  readonly periodEndDate: string;
  readonly totalValueDecimal: string;
  readonly status: MeasurementBulletinFormalStatusValue;
  readonly lineCount: number;
  readonly sourceCount: number;
  readonly technicalResponsibleName: string | null;
  readonly formalizationDate: string | null;
  readonly certified: boolean;
}

export interface MeasurementBulletinFormalStatusWorkspaceRecord {
  readonly id: string;
}

export interface MeasurementBulletinFormalStatusBulletinRecord {
  readonly id: string;
  readonly bulletinNumber: number;
  readonly status: MeasurementBulletinFormalStatusValue;
  readonly header: Record<string, unknown>;
  readonly totals: unknown;
  readonly lines: unknown;
}

export interface MeasurementBulletinFormalStatusCycleRecord {
  readonly status: string;
}

export interface MeasurementBulletinFormalStatusReader {
  /** companyId null exclusivamente para bba_admin -- ver AuthenticatedActor em lib/supabase/server.ts. */
  findWorkspaceByImportId(input: {
    measurementBulletinImportId: string;
    companyId: string | null;
  }): Promise<MeasurementBulletinFormalStatusWorkspaceRecord | null>;

  findBulletinByWorkspaceId(input: {
    measurementWorkspaceId: string;
    companyId: string | null;
  }): Promise<MeasurementBulletinFormalStatusBulletinRecord | null>;

  countLineSources(input: { measurementBulletinId: string }): Promise<number>;

  findCycleByWorkspaceId(input: {
    measurementWorkspaceId: string;
    companyId: string | null;
  }): Promise<MeasurementBulletinFormalStatusCycleRecord | null>;
}

export type GetMeasurementBulletinFormalStatusError = "workspace_not_found" | "bulletin_not_formalized";

export type GetMeasurementBulletinFormalStatusResult =
  | { readonly success: true; readonly formalStatus: MeasurementBulletinFormalStatus }
  | { readonly success: false; readonly error: GetMeasurementBulletinFormalStatusError };

const CERTIFIED_CYCLE_STATUSES = new Set(["certified", "closed"]);

export async function getMeasurementBulletinFormalStatus(
  input: { readonly measurementBulletinImportId: string; readonly companyId: string | null },
  dependencies: { readonly reader: MeasurementBulletinFormalStatusReader }
): Promise<GetMeasurementBulletinFormalStatusResult> {
  const workspace = await dependencies.reader.findWorkspaceByImportId({
    measurementBulletinImportId: input.measurementBulletinImportId,
    companyId: input.companyId
  });

  if (!workspace) {
    return { success: false, error: "workspace_not_found" };
  }

  const bulletin = await dependencies.reader.findBulletinByWorkspaceId({
    measurementWorkspaceId: workspace.id,
    companyId: input.companyId
  });

  if (!bulletin) {
    return { success: false, error: "bulletin_not_formalized" };
  }

  const [sourceCount, cycle] = await Promise.all([
    dependencies.reader.countLineSources({ measurementBulletinId: bulletin.id }),
    dependencies.reader.findCycleByWorkspaceId({ measurementWorkspaceId: workspace.id, companyId: input.companyId })
  ]);

  const header = bulletin.header;
  const headerMetadata = (header.metadata as Record<string, unknown> | undefined) ?? {};
  const totals = (bulletin.totals as Record<string, unknown> | null) ?? {};
  const lines = Array.isArray(bulletin.lines) ? bulletin.lines : [];

  return {
    success: true,
    formalStatus: {
      bulletinNumber: bulletin.bulletinNumber,
      periodStartDate: typeof header.startDate === "string" ? header.startDate : "",
      periodEndDate: typeof header.endDate === "string" ? header.endDate : "",
      totalValueDecimal: typeof totals.canonicalTotalValue === "string" ? totals.canonicalTotalValue : "0",
      status: bulletin.status,
      lineCount: lines.length,
      sourceCount,
      technicalResponsibleName:
        typeof header.technicalResponsibleName === "string" ? header.technicalResponsibleName : null,
      formalizationDate: typeof headerMetadata.formalizationDate === "string" ? headerMetadata.formalizationDate : null,
      certified: cycle !== null && CERTIFIED_CYCLE_STATUSES.has(cycle.status)
    }
  };
}
