import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedActor } from "@/lib/supabase/server";
import {
  getMeasurementBulletinByWorkspaceId,
  getMeasurementWorkspaceByImportId,
  listCertifiedItemBalances,
  listManagedServiceItems,
  listMeasurementWorkspaceLines,
  projectHasAnyCertification
} from "@/lib/bdos/measurement-repository";
import { listPlanningDatasetsByType } from "@/lib/bdos/repository";
import {
  buildMeasurementPhysicalFinancialAnalysis,
  selectConsolidatedPhysicalFinancialDataset
} from "@/lib/bdos/measurement-physical-financial-analysis-service";
import {
  buildManagerialControlView,
  type BuildManagerialControlViewInput,
  type ManagerialControlBulletinLineInput,
  type ManagerialControlView
} from "@/lib/bdos/measurement-managerial-control-service";

/**
 * "Controle Gerencial da Execução" — GET somente-leitura. Compõe a
 * Base Contratual da Obra (todos os itens), a posição CERTIFICADA por
 * item, o BM do período atual e o contexto físico-financeiro do grupo.
 * Nenhuma escrita. Nunca certifica. O histórico documental item a item
 * (MED-01…MED-N) NÃO é lido aqui — Camada B, ainda não importada.
 */

export interface ManagerialControlReader {
  findWorkspaceContext(input: {
    measurementBulletinImportId: string;
    companyId: string | null;
  }): Promise<{ workspaceId: string; companyId: string; engineeringProjectId: string } | null>;
  loadManagerialControlInput(input: {
    workspaceId: string;
    companyId: string | null;
    engineeringProjectId: string;
  }): Promise<BuildManagerialControlViewInput>;
}

export function buildManagerialControlReader(supabase: SupabaseClient): ManagerialControlReader {
  return {
    async findWorkspaceContext(query) {
      const workspace = await getMeasurementWorkspaceByImportId(supabase, {
        measurementBulletinImportId: query.measurementBulletinImportId,
        companyId: query.companyId ?? undefined
      });
      return workspace
        ? { workspaceId: workspace.id, companyId: workspace.companyId, engineeringProjectId: workspace.engineeringProjectId }
        : null;
    },

    async loadManagerialControlInput(query) {
      const [contractItems, balances, bulletin, hasCertification, datasetRows, workspaceLines] = await Promise.all([
        listManagedServiceItems(supabase, { engineeringProjectId: query.engineeringProjectId, companyId: query.companyId }),
        listCertifiedItemBalances(supabase, { engineeringProjectId: query.engineeringProjectId, companyId: query.companyId }),
        getMeasurementBulletinByWorkspaceId(supabase, { measurementWorkspaceId: query.workspaceId, companyId: query.companyId ?? undefined }),
        projectHasAnyCertification(supabase, { engineeringProjectId: query.engineeringProjectId, companyId: query.companyId }),
        listPlanningDatasetsByType(supabase, {
          companyId: query.companyId,
          engineeringProjectId: query.engineeringProjectId,
          detectedType: "fisico-financeiro"
        }),
        listMeasurementWorkspaceLines(supabase, { measurementWorkspaceId: query.workspaceId })
      ]);

      const sourceByItemId = new Map(
        workspaceLines.map((line) => [
          line.managedServiceItemId,
          {
            sheetName: line.sourceSheetName,
            row: line.sourceRowNumber,
            columns: Array.from(new Set([line.sourcePhysicalColumn, line.sourceFinancialColumn].filter((c): c is string => c !== null)))
          }
        ])
      );

      const rawLines = Array.isArray(bulletin?.lines) ? (bulletin?.lines as ReadonlyArray<Record<string, unknown>>) : [];
      const header = (bulletin?.header as Record<string, unknown> | undefined) ?? {};
      const totals = (bulletin?.totals as Record<string, unknown> | null) ?? {};
      const periodStartDate = typeof header.startDate === "string" ? header.startDate : "";
      const periodEndDate = typeof header.endDate === "string" ? header.endDate : "";

      const lines: ManagerialControlBulletinLineInput[] = rawLines.map((raw) => {
        const serviceItemId = typeof raw.serviceItemId === "string" ? raw.serviceItemId : null;
        const source = serviceItemId ? sourceByItemId.get(serviceItemId) : undefined;
        const metadata = (raw.metadata as Record<string, unknown> | undefined) ?? {};
        return {
          managedServiceItemId: serviceItemId,
          code: typeof raw.serviceItemCode === "string" ? raw.serviceItemCode : "",
          unit: typeof raw.unit === "string" ? raw.unit : null,
          quantityDecimal: typeof raw.canonicalQuantity === "string" ? raw.canonicalQuantity : String(raw.quantity ?? "0"),
          valueDecimal: typeof raw.canonicalTotalValue === "string" ? raw.canonicalTotalValue : String(raw.totalValue ?? "0"),
          sheetName: source?.sheetName ?? (typeof metadata.sourceSheetName === "string" ? metadata.sourceSheetName : null),
          row: source?.row ?? (typeof metadata.sourceRowNumber === "number" ? metadata.sourceRowNumber : null),
          columns:
            source?.columns ??
            Array.from(new Set([metadata.sourcePhysicalColumn, metadata.sourceFinancialColumn].filter((c): c is string => typeof c === "string")))
        };
      });

      // Contexto físico-financeiro do grupo -- mesma seleção
      // determinística já usada na tela Revisar medição.
      const selection = selectConsolidatedPhysicalFinancialDataset(
        datasetRows.map((row) => ({
          id: row.id,
          schemaVersion: row.datasetSchemaVersion,
          createdAt: row.createdAt,
          fileName: row.fileName,
          dataset: row.dataset
        }))
      );
      const selectedDataset = selection.outcome === "selected" ? selection.selected.dataset : null;
      const physicalFinancial = buildMeasurementPhysicalFinancialAnalysis({
        planningDataset: selectedDataset,
        datasetId: selection.outcome === "selected" ? selection.selected.id : null,
        sourceFileName: selection.outcome === "selected" ? selection.selected.fileName : null,
        measurementPeriod: { startDate: periodStartDate, endDate: periodEndDate },
        measuredItemCodes: contractItems.map((i) => i.code)
      });

      return {
        contractItems: contractItems.map((i) => ({
          id: i.id,
          code: i.code,
          description: i.description,
          unit: i.unit,
          contractQuantityDecimal: i.contractQuantityDecimal,
          unitPriceDecimal: i.unitPriceDecimal,
          measurementType: i.measurementType
        })),
        certifiedBalances: balances.map((b) => ({
          managedServiceItemId: b.managedServiceItemId,
          contractedValueDecimal: b.contractedValueDecimal,
          certifiedAccumulatedQuantityDecimal: b.certifiedAccumulatedQuantityDecimal,
          certifiedAccumulatedValueDecimal: b.certifiedAccumulatedValueDecimal
        })),
        currentBulletin: bulletin
          ? {
              bulletinNumber: bulletin.bulletinNumber,
              periodLabel: periodStartDate && periodEndDate ? `${periodStartDate} a ${periodEndDate}` : null,
              totalValueDecimal: typeof totals.canonicalTotalValue === "string" ? totals.canonicalTotalValue : null,
              lines
            }
          : null,
        certificationRegistered: hasCertification,
        physicalFinancial,
        contractOfficialValueDecimal: selectedDataset?.financial?.contractValue != null ? String(selectedDataset.financial.contractValue) : null
      };
    }
  };
}

export interface HandleGetManagerialControlInput {
  readonly auth: AuthenticatedActor | null;
  readonly measurementBulletinImportId: string | undefined;
}

export interface HandleGetManagerialControlOutcome {
  readonly status: number;
  readonly body: unknown;
}

export async function handleGetManagerialControl(
  input: HandleGetManagerialControlInput,
  dependencies: { readonly reader: ManagerialControlReader }
): Promise<HandleGetManagerialControlOutcome> {
  if (!input.auth) {
    return { status: 401, body: { error: "unauthenticated" } };
  }
  if (!input.measurementBulletinImportId || input.measurementBulletinImportId.trim().length === 0) {
    return { status: 400, body: { error: "missing_measurement_bulletin_import_id" } };
  }

  const context = await dependencies.reader.findWorkspaceContext({
    measurementBulletinImportId: input.measurementBulletinImportId,
    companyId: input.auth.companyId
  });
  if (!context) {
    return { status: 404, body: { error: "workspace_not_found" } };
  }

  const viewInput = await dependencies.reader.loadManagerialControlInput({
    workspaceId: context.workspaceId,
    companyId: input.auth.companyId,
    engineeringProjectId: context.engineeringProjectId
  });

  const view: ManagerialControlView = buildManagerialControlView(viewInput);
  return { status: 200, body: { data: view } };
}
