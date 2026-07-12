// Importa o construtor de fixture .xlsx sintético direto de bdos-core
// por caminho relativo, não via `@bba/bdos-core/...` -- deliberado.
// `xlsx-test-fixtures.ts` é infraestrutura de teste interna daquele
// pacote (usada hoje só por bulletin-import.test.ts), nunca pensada
// como API pública -- expô-la no `exports` do package.json misturaria
// utilitário de teste com superfície de produção. Como este arquivo
// também é só test helper (nunca importado por código de produção de
// apps/web), reaproveitar via caminho relativo evita duplicar ~200
// linhas de escritor de ZIP mínimo sem violar PLATFORM_ARCHITECTURE.md
// §4 (essa regra governa o grafo de import de produção/Studio, não
// helpers de teste).
import {
  buildXlsxFixture,
  type FixtureSheetSpec
} from "../../../../../packages/bdos-core/src/domain/schedule-management/adapters/excel-import/xlsx-test-fixtures";

export type { FixtureSheetSpec };
export { buildXlsxFixture };

const PERIOD_LABEL_ROW = [
  "ITEM",
  "DISCRIMINAÇÃO",
  "UND.",
  "VALORES DE CONTRATO",
  null,
  null,
  "CONTROLE FINANCEIRO – MEDIÇÃO",
  null,
  "MED-01",
  null,
  "MED-02",
  null,
  "MED-03",
  null
];
const SUB_HEADER_ROW = [
  null,
  null,
  null,
  "QUANT.",
  "PREÇO UNITÁRIO (R$)",
  "PREÇO TOTAL (R$)",
  "QUANTITATIVO",
  "VALOR (R$)",
  "FISICO",
  "FINANCEIRO",
  "FISICO",
  "FINANCEIRO",
  "FISICO",
  "FINANCEIRO"
];

export interface SimpleBulletinLineSpec {
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly contractQuantity: number;
  readonly contractUnitPrice: number;
  readonly officialQuantity: number;
  readonly officialValue: number;
  /** Grade MED-03 (FISICO/FINANCEIRO) -- default = igual ao oficial, para nunca disparar historical_grid_not_authoritative sem pedir. */
  readonly gridPhysical?: number;
  readonly gridFinancial?: number;
}

/**
 * Fixture sintético de Boletim de Medição, mesma estrutura comprovada
 * de bulletin-import.test.ts (cabeçalho em 2 linhas + PERIOD_LABEL_ROW
 * + SUB_HEADER_ROW + linhas de dado + TOTAL GERAL), sempre com bulletin
 * number 3 e grade MED-01/02/03 (mínimo exigido por
 * MINIMUM_PERIOD_COLUMNS) -- por padrão a grade MED-03 replica os
 * valores oficiais, para produzir um cenário limpo (zero issues,
 * `reconciled`) quando não se está testando divergência de
 * propósito. `declaredOfficialTotalOverride` permite forçar
 * official_period_total_mismatch quando necessário.
 */
export function buildSimpleBulletinFixture(params: {
  readonly sheetName?: string;
  readonly dateRange?: string;
  readonly lines: ReadonlyArray<SimpleBulletinLineSpec>;
  readonly parentAggregatorCode?: string;
  readonly parentAggregatorName?: string;
  readonly declaredOfficialTotalOverride?: number;
  readonly omitOfficialBlock?: boolean;
}): Uint8Array {
  const sheetName = params.sheetName ?? "BOLETIM DE MEDIÇÃO 03";
  const dateRange = params.dateRange ?? "01/03/2026 A 31/03/2026";

  const rows: Array<ReadonlyArray<string | number | null>> = [
    ["", "", "", `BOLETIM DE MEDIÇÃO 03`],
    ["", "", "", `BOLETIM Nº 03 (${dateRange})`],
    params.omitOfficialBlock ? PERIOD_LABEL_ROW.map((cell) => (cell === "CONTROLE FINANCEIRO – MEDIÇÃO" ? "OUTRO BLOCO" : cell)) : PERIOD_LABEL_ROW,
    SUB_HEADER_ROW
  ];

  if (params.parentAggregatorCode) {
    rows.push([params.parentAggregatorCode, params.parentAggregatorName ?? "AGRUPADOR", null, null, null, null, null, null, null, null, null, null, null, null]);
  }

  let officialTotal = 0;
  for (const line of params.lines) {
    const gridPhysical = line.gridPhysical ?? line.officialQuantity;
    const gridFinancial = line.gridFinancial ?? line.officialValue;
    rows.push([
      line.code,
      line.name,
      line.unit,
      line.contractQuantity,
      line.contractUnitPrice,
      line.contractQuantity * line.contractUnitPrice,
      line.officialQuantity,
      line.officialValue,
      gridPhysical,
      gridFinancial,
      gridPhysical,
      gridFinancial,
      gridPhysical,
      gridFinancial
    ]);
    officialTotal += line.officialValue;
  }

  rows.push([
    "TOTAL GERAL (R$)",
    null,
    null,
    null,
    null,
    null,
    null,
    params.declaredOfficialTotalOverride ?? officialTotal,
    null,
    null,
    null,
    null,
    null,
    null
  ]);

  return buildXlsxFixture([{ name: sheetName, rows }]);
}
