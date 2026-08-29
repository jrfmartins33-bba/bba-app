import type { BudgetComparedItem, BudgetComparisonClassification } from "@bba/bdos-core/services/procurement-engineering";

export interface OfficialLine {
  readonly id: string;
  readonly kind: "Group" | "Subgroup" | "ServiceItem";
  readonly description: { readonly status: "Confirmed"; readonly text: string } | { readonly status: "AbsentFromSource" };
  readonly externalCode: string | null;
  readonly parentLineId: string | null;
  readonly position: number;
  readonly totalCents: number | null;
  readonly quantity?: string | null;
  readonly unit?: string | null;
  readonly unitPriceCents?: number | null;
}

export interface OfficialBudgetDto {
  readonly id: string;
  readonly status: "Consolidated";
  readonly lines: ReadonlyArray<OfficialLine>;
}

export interface LineIndex {
  readonly childrenByParent: ReadonlyMap<string | null, ReadonlyArray<OfficialLine>>;
  readonly totalsByLine: ReadonlyMap<string, number>;
  readonly linesById: ReadonlyMap<string, OfficialLine>;
}

export type ComparisonFilter = "All" | BudgetComparisonClassification;

export function buildLineIndex(lines: ReadonlyArray<OfficialLine>): LineIndex {
  const childrenByParent = new Map<string | null, OfficialLine[]>();
  const linesById = new Map(lines.map((line) => [line.id, line]));
  for (const line of lines) {
    const current = childrenByParent.get(line.parentLineId) ?? [];
    current.push(line);
    childrenByParent.set(line.parentLineId, current);
  }
  for (const children of childrenByParent.values()) children.sort((left, right) => left.position - right.position);

  const totalsByLine = new Map<string, number>();
  const calculate = (line: OfficialLine): number => {
    const cached = totalsByLine.get(line.id);
    if (cached !== undefined) return cached;
    const total = line.kind === "ServiceItem"
      ? line.totalCents ?? 0
      : (childrenByParent.get(line.id) ?? []).reduce((sum, child) => sum + calculate(child), 0);
    totalsByLine.set(line.id, total);
    return total;
  };
  for (const line of lines) calculate(line);
  return { childrenByParent, totalsByLine, linesById };
}

export function buildVisibleLineIds(input: {
  readonly budget: OfficialBudgetDto;
  readonly comparisonByLineId: ReadonlyMap<string, BudgetComparedItem>;
  readonly linesById: ReadonlyMap<string, OfficialLine>;
  readonly comparisonMode: boolean;
  readonly filter: ComparisonFilter;
  readonly search: string;
}): ReadonlySet<string> {
  if (!input.comparisonMode) return new Set(input.budget.lines.map((line) => line.id));
  const normalizedSearch = normalizeSearch(input.search);
  const visible = new Set<string>();
  for (const line of input.budget.lines) {
    if (line.kind !== "ServiceItem") continue;
    const comparison = input.comparisonByLineId.get(line.id);
    if (!comparison || (input.filter !== "All" && comparison.classification !== input.filter)) continue;
    const description = line.description.status === "Confirmed" ? line.description.text : "";
    if (normalizedSearch && !normalizeSearch(`${line.externalCode ?? ""} ${description}`).includes(normalizedSearch)) continue;
    visible.add(line.id);
    let parentLineId = line.parentLineId;
    while (parentLineId) {
      visible.add(parentLineId);
      parentLineId = input.linesById.get(parentLineId)?.parentLineId ?? null;
    }
  }
  return visible;
}

/** Formata uma quantidade canônica sem reintroduzir ponto flutuante na apresentação. */
export function formatCanonicalQuantityPtBr(value: string | null): string {
  if (value === null) return "Não informada";
  const match = /^(\d+)(?:\.(\d+))?$/u.exec(value);
  if (!match) return value;
  const integer = (match[1] ?? "0").replace(/\B(?=(\d{3})+(?!\d))/gu, ".");
  return match[2] ? `${integer},${match[2]}` : integer;
}

export function formatDocumentUnitPtBr(value: string | null): string {
  if (value === null || value.trim().length === 0) return "Não informada";
  const normalized = value.trim();
  if (normalized.toLocaleUpperCase("pt-BR") === "M2") return "M²";
  if (normalized.toLocaleUpperCase("pt-BR") === "M3") return "M³";
  return normalized;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("pt-BR").trim();
}
