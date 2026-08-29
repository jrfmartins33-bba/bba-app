/**
 * "Revisar medição" -- Application Service somente-leitura para a
 * tela dedicada de revisão do boletim formal (Relatório Executivo →
 * Revisar medição → Ver itens medidos → Certificar/Recusar). Mesma
 * disciplina de measurement-bulletin-formal-status-service.ts: reader
 * injetado, nenhuma dependência direta de SupabaseClient, nunca
 * calcula/formaliza/certifica, só projeta o que já está persistido.
 *
 * `materialDivergenceCount`/`technicalObservationCount` NÃO são
 * recalculados aqui -- vêm de `criticalItems` (DecisionBrief já
 * construído por getMeasurementDecisionBrief, a mesma classificação
 * determinística já aprovada no Relatório Executivo). Este serviço
 * nunca reclassifica severidade/materialidade.
 */

import type { DecisionBrief, DecisionBriefCriticalItem, DecisionBriefSourceReference } from "@bba/bdos-core/decision-brief";

export type MeasurementBulletinReviewStatus = "Draft" | "Validated" | "Finalized" | "Cancelled";

export interface MeasurementBulletinReviewItem {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly unit: string;
  readonly quantityDecimal: string;
  readonly unitValueDecimal: string;
  readonly valueDecimal: string;
  readonly evidenceReferences: ReadonlyArray<DecisionBriefSourceReference>;
  /** managed_service_items.id -- identidade persistida do item operacional, usada para ligar à Proposta Vencedora via contract_execution_item_links (nunca por texto/código). */
  readonly managedServiceItemId: string | null;
}

export interface MeasurementBulletinReview {
  readonly bulletinNumber: number;
  readonly periodStartDate: string;
  readonly periodEndDate: string;
  readonly totalValueDecimal: string;
  readonly status: MeasurementBulletinReviewStatus;
  readonly itemCount: number;
  readonly sourceCount: number;
  readonly materialDivergenceCount: number;
  readonly technicalObservationCount: number;
  readonly technicalResponsibleName: string | null;
  readonly certified: boolean;
  readonly items: ReadonlyArray<MeasurementBulletinReviewItem>;
  /** Mesmos itens do DecisionBrief (materiality="technical_observation"), verbatim -- nunca reclassificados ou reescritos nesta tela. */
  readonly technicalObservations: ReadonlyArray<DecisionBriefCriticalItem>;
}

export interface MeasurementBulletinReviewWorkspaceRecord {
  readonly id: string;
}

export interface MeasurementBulletinReviewBulletinRecord {
  readonly id: string;
  readonly bulletinNumber: number;
  readonly status: MeasurementBulletinReviewStatus;
  readonly header: Record<string, unknown>;
  readonly totals: unknown;
  readonly lines: unknown;
}

export interface MeasurementBulletinReviewWorkspaceLineRecord {
  readonly id: string;
  readonly sourceSheetName: string | null;
  readonly sourceRowNumber: number | null;
  readonly sourcePhysicalColumn: string | null;
  readonly sourceFinancialColumn: string | null;
}

export interface MeasurementBulletinReviewLineSourceRecord {
  readonly bulletinLineId: string;
  readonly measurementWorkspaceLineId: string;
}

export interface MeasurementBulletinReviewCycleRecord {
  readonly status: string;
}

export interface MeasurementBulletinReviewReader {
  /** companyId null exclusivamente para bba_admin -- ver AuthenticatedActor em lib/supabase/server.ts. */
  findWorkspaceByImportId(input: {
    measurementBulletinImportId: string;
    companyId: string | null;
  }): Promise<MeasurementBulletinReviewWorkspaceRecord | null>;

  findBulletinByWorkspaceId(input: {
    measurementWorkspaceId: string;
    companyId: string | null;
  }): Promise<MeasurementBulletinReviewBulletinRecord | null>;

  listWorkspaceLines(input: { measurementWorkspaceId: string }): Promise<ReadonlyArray<MeasurementBulletinReviewWorkspaceLineRecord>>;

  listLineSources(input: { measurementBulletinId: string }): Promise<ReadonlyArray<MeasurementBulletinReviewLineSourceRecord>>;

  findCycleByWorkspaceId(input: {
    measurementWorkspaceId: string;
    companyId: string | null;
  }): Promise<MeasurementBulletinReviewCycleRecord | null>;
}

export type GetMeasurementBulletinReviewError = "workspace_not_found" | "bulletin_not_formalized";

export type GetMeasurementBulletinReviewResult =
  | { readonly success: true; readonly review: MeasurementBulletinReview }
  | { readonly success: false; readonly error: GetMeasurementBulletinReviewError };

const CERTIFIED_CYCLE_STATUSES = new Set(["certified", "closed"]);

export async function getMeasurementBulletinReview(
  input: {
    readonly measurementBulletinImportId: string;
    readonly companyId: string | null;
    readonly criticalItems: DecisionBrief["criticalItems"];
  },
  dependencies: { readonly reader: MeasurementBulletinReviewReader }
): Promise<GetMeasurementBulletinReviewResult> {
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

  const [workspaceLines, lineSources, cycle] = await Promise.all([
    dependencies.reader.listWorkspaceLines({ measurementWorkspaceId: workspace.id }),
    dependencies.reader.listLineSources({ measurementBulletinId: bulletin.id }),
    dependencies.reader.findCycleByWorkspaceId({ measurementWorkspaceId: workspace.id, companyId: input.companyId })
  ]);

  const workspaceLinesById = new Map(workspaceLines.map((line) => [line.id, line]));
  const workspaceLineIdByBulletinLineId = new Map(lineSources.map((source) => [source.bulletinLineId, source.measurementWorkspaceLineId]));

  const header = bulletin.header;
  const headerMetadata = (header.metadata as Record<string, unknown> | undefined) ?? {};
  const totals = (bulletin.totals as Record<string, unknown> | null) ?? {};
  const lines = Array.isArray(bulletin.lines) ? bulletin.lines : [];

  const items: MeasurementBulletinReviewItem[] = lines.map((raw) => toReviewItem(raw, workspaceLineIdByBulletinLineId, workspaceLinesById, input.measurementBulletinImportId));

  const materialDivergenceCount = input.criticalItems.filter((item) => item.materiality === "material").length;
  const technicalObservations = input.criticalItems.filter((item) => item.materiality === "technical_observation");

  return {
    success: true,
    review: {
      bulletinNumber: bulletin.bulletinNumber,
      periodStartDate: typeof header.startDate === "string" ? header.startDate : "",
      periodEndDate: typeof header.endDate === "string" ? header.endDate : "",
      totalValueDecimal: typeof totals.canonicalTotalValue === "string" ? totals.canonicalTotalValue : "0",
      status: bulletin.status,
      itemCount: items.length,
      sourceCount: lineSources.length,
      materialDivergenceCount,
      technicalObservationCount: technicalObservations.length,
      technicalResponsibleName: typeof header.technicalResponsibleName === "string" ? header.technicalResponsibleName : null,
      certified: cycle !== null && CERTIFIED_CYCLE_STATUSES.has(cycle.status),
      items,
      technicalObservations
    }
  };
}

function toReviewItem(
  raw: unknown,
  workspaceLineIdByBulletinLineId: ReadonlyMap<string, string>,
  workspaceLinesById: ReadonlyMap<string, MeasurementBulletinReviewWorkspaceLineRecord>,
  sourceImportId: string
): MeasurementBulletinReviewItem {
  const line = (raw ?? {}) as Record<string, unknown>;
  const id = typeof line.id === "string" ? line.id : "";
  const workspaceLineId = workspaceLineIdByBulletinLineId.get(id);
  const workspaceLine = workspaceLineId ? workspaceLinesById.get(workspaceLineId) : undefined;

  return {
    id,
    code: typeof line.serviceItemCode === "string" ? line.serviceItemCode : "",
    description: typeof line.description === "string" ? line.description : "",
    unit: typeof line.unit === "string" ? line.unit : "",
    quantityDecimal: typeof line.canonicalQuantity === "string" ? line.canonicalQuantity : String(line.quantity ?? "0"),
    unitValueDecimal: typeof line.canonicalUnitValue === "string" ? line.canonicalUnitValue : String(line.unitValue ?? "0"),
    valueDecimal: typeof line.canonicalTotalValue === "string" ? line.canonicalTotalValue : String(line.totalValue ?? "0"),
    evidenceReferences: workspaceLine ? buildEvidenceReferences(workspaceLine, sourceImportId) : [],
    managedServiceItemId: typeof line.serviceItemId === "string" ? line.serviceItemId : null
  };
}

function buildEvidenceReferences(
  workspaceLine: MeasurementBulletinReviewWorkspaceLineRecord,
  sourceImportId: string
): ReadonlyArray<DecisionBriefSourceReference> {
  if (workspaceLine.sourceSheetName === null || workspaceLine.sourceRowNumber === null) {
    return [];
  }

  const columns = Array.from(
    new Set([workspaceLine.sourcePhysicalColumn, workspaceLine.sourceFinancialColumn].filter((column): column is string => column !== null))
  );

  if (columns.length === 0) {
    return [
      {
        sourceType: "spreadsheet_cell",
        sourceId: sourceImportId,
        locator: { sheetName: workspaceLine.sourceSheetName, row: workspaceLine.sourceRowNumber }
      }
    ];
  }

  return columns.map((column) => ({
    sourceType: "spreadsheet_cell",
    sourceId: sourceImportId,
    locator: { sheetName: workspaceLine.sourceSheetName as string, row: workspaceLine.sourceRowNumber as number, column }
  }));
}
