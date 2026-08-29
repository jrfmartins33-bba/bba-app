/**
 * Prévia determinística de certificação -- "o usuário precisa entender
 * exatamente o efeito da decisão" antes de confirmar. Servidor calcula
 * (acumulado antes/desta medição/depois, saldo contratual depois),
 * frontend só apresenta -- nenhuma soma/subtração de dinheiro acontece
 * na UI. Usa exclusivamente a aritmética decimal exata já existente em
 * @bba/bdos-core/domain/measurement-certification (addMeasurementDecimals/
 * subtractMeasurementDecimals, bigint por dentro -- nunca ponto
 * flutuante), nunca uma reimplementação própria.
 *
 * Resolução do contrato: reaproveita a mesma regra já usada por
 * ContractBaselineRepository.findContractBaselineByProject (o contrato
 * mais recente do projeto) -- não inventa uma nova regra de seleção
 * (ex.: filtrar por status) só para esta tela.
 */

import { addMeasurementDecimals, subtractMeasurementDecimals } from "@bba/bdos-core/domain/measurement-certification";

const MONEY_SCALE = 2;

export interface MeasurementCertificationPreview {
  readonly bulletinNumber: number;
  readonly periodStartDate: string;
  readonly periodEndDate: string;
  readonly itemCount: number;
  readonly sourceCount: number;
  readonly materialDivergenceCount: number;
  readonly technicalResponsibleName: string | null;
  readonly measurementValueDecimal: string;
  readonly accumulatedBeforeDecimal: string;
  readonly accumulatedAfterDecimal: string;
  readonly contractBalanceAfterDecimal: string;
}

export interface MeasurementCertificationPreviewWorkspaceRecord {
  readonly id: string;
  readonly companyId: string;
  readonly engineeringProjectId: string;
}

export interface MeasurementCertificationPreviewBulletinRecord {
  readonly id: string;
  readonly bulletinNumber: number;
  readonly status: "Draft" | "Validated" | "Finalized" | "Cancelled";
  readonly header: Record<string, unknown>;
  readonly totals: unknown;
  readonly lineCount: number;
  readonly sourceCount: number;
}

export interface MeasurementCertificationPreviewContractBaseline {
  readonly id: string;
  readonly contractedValueCents: number;
}

export interface MeasurementCertificationPreviewReader {
  /** companyId null exclusivamente para bba_admin -- ver AuthenticatedActor em lib/supabase/server.ts. */
  findWorkspaceByImportId(input: {
    measurementBulletinImportId: string;
    companyId: string | null;
  }): Promise<MeasurementCertificationPreviewWorkspaceRecord | null>;

  findBulletinByWorkspaceId(input: {
    measurementWorkspaceId: string;
    companyId: string | null;
  }): Promise<MeasurementCertificationPreviewBulletinRecord | null>;

  /** null: nenhum contrato encontrado para o projeto -- nunca escolhido arbitrariamente. */
  findContractBaselineForProject(input: {
    companyId: string;
    engineeringProjectId: string;
  }): Promise<MeasurementCertificationPreviewContractBaseline | null>;

  listCertifiedBulletinTotalsForContractBaseline(input: {
    contractBaselineId: string;
    companyId: string;
    excludingMeasurementBulletinId: string;
  }): Promise<ReadonlyArray<{ totalValueDecimal: string }>>;
}

export type GetMeasurementCertificationPreviewError =
  | "workspace_not_found"
  | "bulletin_not_formalized"
  | "admin_company_required"
  | "contract_baseline_not_found";

export type GetMeasurementCertificationPreviewResult =
  | { readonly success: true; readonly preview: MeasurementCertificationPreview }
  | { readonly success: false; readonly error: GetMeasurementCertificationPreviewError };

export async function getMeasurementCertificationPreview(
  input: {
    readonly measurementBulletinImportId: string;
    readonly companyId: string | null;
    readonly materialDivergenceCount: number;
  },
  dependencies: { readonly reader: MeasurementCertificationPreviewReader }
): Promise<GetMeasurementCertificationPreviewResult> {
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

  // Prévia envolve saldo contratual de UMA empresa -- um bba_admin sem
  // companyId próprio (ver AuthenticatedActor) precisa do companyId
  // real do boletim, nunca null, para esta consulta específica (ao
  // contrário das leituras puramente RLS-scoped acima).
  const effectiveCompanyId = input.companyId ?? workspace.companyId;

  const contractBaseline = await dependencies.reader.findContractBaselineForProject({
    companyId: effectiveCompanyId,
    engineeringProjectId: workspace.engineeringProjectId
  });

  if (!contractBaseline) {
    return { success: false, error: "contract_baseline_not_found" };
  }

  const certifiedTotals = await dependencies.reader.listCertifiedBulletinTotalsForContractBaseline({
    contractBaselineId: contractBaseline.id,
    companyId: effectiveCompanyId,
    excludingMeasurementBulletinId: bulletin.id
  });

  const totals = (bulletin.totals as Record<string, unknown> | null) ?? {};
  const measurementValueDecimal = typeof totals.canonicalTotalValue === "string" ? totals.canonicalTotalValue : "0";

  const accumulatedBeforeDecimal = addMeasurementDecimals(
    certifiedTotals.map((entry) => entry.totalValueDecimal),
    MONEY_SCALE
  );
  const accumulatedAfterDecimal = addMeasurementDecimals([accumulatedBeforeDecimal, measurementValueDecimal], MONEY_SCALE);
  const contractedValueDecimal = centsToDecimalString(contractBaseline.contractedValueCents);
  const contractBalanceAfterDecimal = subtractMeasurementDecimals(contractedValueDecimal, accumulatedAfterDecimal, MONEY_SCALE);

  const header = bulletin.header;

  return {
    success: true,
    preview: {
      bulletinNumber: bulletin.bulletinNumber,
      periodStartDate: typeof header.startDate === "string" ? header.startDate : "",
      periodEndDate: typeof header.endDate === "string" ? header.endDate : "",
      itemCount: bulletin.lineCount,
      sourceCount: bulletin.sourceCount,
      materialDivergenceCount: input.materialDivergenceCount,
      technicalResponsibleName: typeof header.technicalResponsibleName === "string" ? header.technicalResponsibleName : null,
      measurementValueDecimal,
      accumulatedBeforeDecimal,
      accumulatedAfterDecimal,
      contractBalanceAfterDecimal
    }
  };
}

// BIGINT cents -> string decimal, aritmética inteira (nunca divisão
// float) -- mesma disciplina de canonicalizeMeasurementDecimal, só que
// a entrada aqui já é um inteiro de centavos, não uma string decimal.
function centsToDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.trunc(Math.abs(cents));
  const whole = Math.trunc(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${negative && abs !== 0 ? "-" : ""}${whole}.${fraction}`;
}
