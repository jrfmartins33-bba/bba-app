import type { ManagerialControlItem, ManagerialItemStatus } from "@/lib/bdos/measurement-managerial-control-service";

/**
 * "Controle Gerencial da Execução" — formatação puramente textual.
 * Nunca refaz matemática: valores já vêm decididos e canônicos do
 * servidor. Vocabulário sem conotação temporal por item — o
 * planejamento oficial atual é por grupo, não por item.
 */

const STATUS_LABEL: Record<ManagerialItemStatus, string> = {
  no_bdos_measurement: "Sem medição registrada no sistema",
  in_execution_bdos: "Em execução (conforme registrado)",
  contract_quantity_reached: "Quantidade contratada atingida",
  above_contract_quantity: "Acima da quantidade contratada",
  insufficient_basis: "Base insuficiente"
};

const STATUS_SHORT: Record<ManagerialItemStatus, string> = {
  no_bdos_measurement: "Sem medição",
  in_execution_bdos: "Em execução",
  contract_quantity_reached: "Qtd. contratada atingida",
  above_contract_quantity: "Acima da qtd. contratada",
  insufficient_basis: "Base insuficiente"
};

export const MANAGERIAL_STATUS_ORDER: ReadonlyArray<ManagerialItemStatus> = [
  "no_bdos_measurement",
  "in_execution_bdos",
  "contract_quantity_reached",
  "above_contract_quantity",
  "insufficient_basis"
];

export function formatManagerialStatus(status: ManagerialItemStatus): string {
  return STATUS_LABEL[status];
}
export function formatManagerialStatusShort(status: ManagerialItemStatus): string {
  return STATUS_SHORT[status];
}

/**
 * Tom visual (§25): sem verde para o Controle Gerencial de quantidades
 * -- verde é reservado a ganho econômico real e comprovado. Em
 * execução / qtd. atingida → azul/informativo; sem medição / base
 * insuficiente → neutro; acima da qtd. contratada → atenção (amber);
 * vermelho fora.
 */
export function managerialStatusTone(status: ManagerialItemStatus): "info" | "neutral" | "caution" {
  if (status === "in_execution_bdos" || status === "contract_quantity_reached") return "info";
  if (status === "above_contract_quantity") return "caution";
  return "neutral";
}

/** "252654.78" -> "R$ 252.654,78". Nunca Number(). */
export function formatManagerialBRL(decimal: string): string {
  const negative = decimal.startsWith("-");
  const [integerPart, fractionalPart = "00"] = (negative ? decimal.slice(1) : decimal).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "−" : ""}R$ ${grouped},${fractionalPart.padEnd(2, "0").slice(0, 2)}`;
}

/** "8.000000" -> "8"; "141400.800000" -> "141.400,8". Remove zeros supérfluos, vírgula pt-BR. */
export function formatManagerialQuantity(decimal: string): string {
  const negative = decimal.startsWith("-");
  const [integerPart, fractionalPart = ""] = (negative ? decimal.slice(1) : decimal).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const trimmed = fractionalPart.replace(/0+$/, "");
  return `${negative ? "−" : ""}${grouped}${trimmed ? `,${trimmed}` : ""}`;
}

/** "11.11" -> "11,11%". "-3.20" -> "−3,20%". null passa direto. */
export function formatManagerialPercent(decimal: string | null): string | null {
  if (decimal === null) return null;
  const negative = decimal.startsWith("-");
  return `${negative ? "−" : ""}${(negative ? decimal.slice(1) : decimal).replace(".", ",")}%`;
}

/**
 * Largura (0–100) da barrinha de progresso na linha do item —
 * PURAMENTE VISUAL. Nunca é um cálculo de negócio: o "% executado"
 * mostrado ao usuário continua vindo pronto do servidor
 * (`item.executedPercent`); aqui só se decide quantos pixels a barra
 * ocupa, saturando em 100 para quantidades acima da contratada.
 */
export function managerialBarWidthPercent(executedPercent: string | null): number {
  if (executedPercent === null) return 0;
  const parsed = Number(executedPercent);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed >= 100 ? 100 : Math.round(parsed);
}

// ---- "Evolução da execução" — rótulo de mês e texto-resumo ----

/** "2026-06-01" -> "jun/26". Determinístico, sem Date/locale. */
export function formatHistoryMonthLabel(point: { readonly periodLabel: string; readonly periodDate: string }): string {
  const match = /^(\d{4})-(\d{2})/.exec(point.periodDate);
  if (!match) return point.periodLabel;
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const monthIndex = Number(match[2]) - 1;
  return `${names[monthIndex] ?? match[2]}/${match[1].slice(2)}`;
}

/**
 * Texto-resumo da seção "Evolução da execução" QUANDO o período
 * selecionado NÃO tem realização documentada. Construído genericamente
 * do read model: nunca inventa acumulado — se não houver período
 * anterior com realização, a parte do acumulado é omitida. Ausência
 * nunca vira zero; período sem realização nunca vira atraso/adiantamento.
 * Só formata; não recalcula nada.
 */
export function buildExecutionHistoryNoRealizationSummary(input: {
  readonly selectedMonthLabel: string;
  readonly plannedPeriodValueDecimal: string;
  readonly lastRealized: { readonly monthLabel: string; readonly actualAccumulatedValueDecimal: string } | null;
}): string {
  const planned = `planejado no período: ${formatManagerialBRL(input.plannedPeriodValueDecimal)}`;
  if (input.lastRealized === null) {
    return `Sem realização registrada em ${input.selectedMonthLabel} · ${planned}.`;
  }
  return (
    `Sem realização registrada em ${input.selectedMonthLabel} · ` +
    `realizado acumulado disponível até ${input.lastRealized.monthLabel}: ` +
    `${formatManagerialBRL(input.lastRealized.actualAccumulatedValueDecimal)} · ${planned}.`
  );
}

// ---- filtro / ordenação (determinísticos, sobre dados já do servidor) ----

export type ManagerialSortKey = "code" | "contract_value" | "registered_value" | "balance" | "executed_percent";

export interface ManagerialFilterState {
  readonly search: string;
  readonly groupCode: string | "all";
  readonly status: ManagerialItemStatus | "all";
  readonly onlyMeasuredThisPeriod: boolean;
  readonly onlyWithoutMeasurement: boolean;
  readonly onlyContractQuantityReached: boolean;
  readonly onlyAboveContractQuantity: boolean;
  readonly sort: ManagerialSortKey;
}

export const DEFAULT_MANAGERIAL_FILTER: ManagerialFilterState = {
  search: "",
  groupCode: "all",
  status: "all",
  onlyMeasuredThisPeriod: false,
  onlyWithoutMeasurement: false,
  onlyContractQuantityReached: false,
  onlyAboveContractQuantity: false,
  sort: "code"
};

function toCents(decimal: string): bigint {
  const negative = decimal.startsWith("-");
  const [int, frac = ""] = (negative ? decimal.slice(1) : decimal).split(".");
  const v = BigInt(int || "0") * 100000000n + BigInt((frac + "00000000").slice(0, 8) || "0");
  return negative ? -v : v;
}
function cmpDecimalsDesc(a: string, b: string): number {
  const d = toCents(b) - toCents(a);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}

export function applyManagerialFilter(
  items: ReadonlyArray<ManagerialControlItem>,
  filter: ManagerialFilterState
): ReadonlyArray<ManagerialControlItem> {
  const q = filter.search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (q && !item.code.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
    if (filter.groupCode !== "all" && item.groupCode !== filter.groupCode) return false;
    if (filter.status !== "all" && item.status !== filter.status) return false;
    if (filter.onlyMeasuredThisPeriod && !item.flags.measuredThisPeriod) return false;
    if (filter.onlyWithoutMeasurement && item.status !== "no_bdos_measurement") return false;
    if (filter.onlyContractQuantityReached && item.status !== "contract_quantity_reached") return false;
    if (filter.onlyAboveContractQuantity && item.status !== "above_contract_quantity") return false;
    return true;
  });

  const sorted = [...filtered];
  switch (filter.sort) {
    case "contract_value":
      sorted.sort((a, b) => cmpDecimalsDesc(a.contractedValueDecimal, b.contractedValueDecimal));
      break;
    case "registered_value":
      sorted.sort((a, b) => cmpDecimalsDesc(a.bdosRegisteredValueDecimal, b.bdosRegisteredValueDecimal));
      break;
    case "balance":
      sorted.sort((a, b) => cmpDecimalsDesc(a.financialBalanceDecimal, b.financialBalanceDecimal));
      break;
    case "executed_percent":
      sorted.sort((a, b) => cmpDecimalsDesc(a.executedPercent ?? "-1", b.executedPercent ?? "-1"));
      break;
    default:
      sorted.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  return sorted;
}
