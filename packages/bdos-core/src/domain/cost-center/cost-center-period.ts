/**
 * Resolução do PERÍODO GERENCIAL da tela de Centros de Custo — puro, sem I/O.
 *
 * Regra de prioridade para decidir qual período abrir por padrão:
 *
 *   CUSTO REGISTRADO  >  MEDIÇÃO FORMAL  >  MÊS CORRENTE
 *
 * A tela de Centros de Custo é sobre custos: o período default vem dos
 * próprios custos registrados. A medição formal só entra como fallback
 * (e permanece a base da comparação gerencial, não do período).
 */

const MONTH_LABELS_PT_BR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "2025-03" → "mar/2025". Entrada não-YYYY-MM é devolvida como está. */
export function formatCostCenterPeriodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return period;
  return `${MONTH_LABELS_PT_BR[monthIndex]}/${match[1]}`;
}

export function isYearMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export interface PickDefaultCostCenterPeriodInput {
  /** Períodos "YYYY-MM" que possuem custos registrados (qualquer ordem). */
  readonly costEntryPeriods: ReadonlyArray<string>;
  /** Período "YYYY-MM" do boletim de medição formal mais recente, se houver. */
  readonly latestBulletinPeriod: string | null;
  /** Mês corrente "YYYY-MM" (fornecido pelo chamador; nada de Date aqui). */
  readonly currentYearMonth: string;
}

export function pickDefaultCostCenterPeriod(input: PickDefaultCostCenterPeriodInput): string {
  const validCostPeriods = input.costEntryPeriods.filter(isYearMonth);
  if (validCostPeriods.length > 0) {
    // "YYYY-MM" ordena lexicograficamente = cronologicamente.
    return [...validCostPeriods].sort().reverse()[0];
  }
  if (isYearMonth(input.latestBulletinPeriod)) {
    return input.latestBulletinPeriod;
  }
  return input.currentYearMonth;
}

export interface AvailablePeriodOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Períodos com custos, únicos, ordenados do mais recente para o mais
 * antigo, com rótulo pt-BR pronto. `ensure` garante que o período
 * atualmente exibido apareça na lista mesmo que não tenha custos
 * (ex.: período explícito e vazio).
 */
export function buildAvailablePeriods(
  periods: ReadonlyArray<string>,
  ensure?: string | null,
): ReadonlyArray<AvailablePeriodOption> {
  const set = new Set(periods.filter(isYearMonth));
  if (isYearMonth(ensure)) set.add(ensure);
  return [...set]
    .sort()
    .reverse()
    .map((value) => ({ value, label: formatCostCenterPeriodLabel(value) }));
}
