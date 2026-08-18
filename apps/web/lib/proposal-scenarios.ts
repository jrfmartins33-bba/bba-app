export type ScenarioComparisonKind = "Reduction" | "Increase" | "Equal";

export interface ProposalScenarioDto {
  readonly id: string;
  readonly sourceBudgetId: string;
  readonly name: string;
  readonly officialValueCents: number;
  readonly targetValueCents: number;
  readonly differenceCents: number;
  readonly differenceBasisPoints: string;
  readonly comparisonKind: ScenarioComparisonKind;
  readonly createdAt: string;
}

export interface ConsolidatedBudgetSummaryDto {
  readonly id: string;
  readonly status: "Consolidated";
  readonly officialValueCents: number;
  readonly updatedAt: string;
}

export function formatCentsPtBr(cents: number): string {
  const value = BigInt(cents);
  const reais = value / 100n;
  const centavos = (value % 100n).toString().padStart(2, "0");
  return `R$ ${reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${centavos}`;
}

export function formatBasisPointsPtBr(basisPoints: string, kind: ScenarioComparisonKind): string {
  const value = BigInt(basisPoints);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  const sign = kind === "Reduction" ? "− " : kind === "Increase" ? "+ " : "";
  return `${sign}${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}%`;
}

export function formatDifferencePtBr(scenario: ProposalScenarioDto): string {
  const sign = scenario.comparisonKind === "Reduction" ? "− " : scenario.comparisonKind === "Increase" ? "+ " : "";
  return `${sign}${formatCentsPtBr(scenario.differenceCents)}`;
}

export function parseBrlToCents(value: string): number | null {
  const normalized = value.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{0,2})?$|^\d+(?:,\d{0,2})?$/.test(normalized)) return null;
  const [wholeRaw, fractionRaw = ""] = normalized.split(",");
  const whole = wholeRaw.replace(/\./g, "").replace(/^0+(?=\d)/, "");
  const centsText = `${whole || "0"}${fractionRaw.padEnd(2, "0")}`;
  const cents = Number(centsText);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export function inputValueFromCents(cents: number): string {
  return formatCentsPtBr(cents).replace("R$ ", "");
}

export function comparisonLabel(kind: ScenarioComparisonKind): string {
  if (kind === "Reduction") return "Redução";
  if (kind === "Increase") return "Acréscimo";
  return "Sem diferença";
}
