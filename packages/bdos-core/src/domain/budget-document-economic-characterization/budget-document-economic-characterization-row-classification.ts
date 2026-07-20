import type { NeutralDocumentLine } from "../budget-document-location/page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { BudgetColumnRole, ColumnRoleAssignment, ProposedLineType } from "./budget-document-economic-characterization.types";
import { cellVerbatimText, isHeaderCandidateLine } from "./budget-document-economic-characterization-column-labels";

export type HierarchicalCodeLevel = "group" | "subgroup" | "service_item";

export interface HierarchicalCodeParse {
  readonly level: HierarchicalCodeLevel;
  readonly groupSegment: string;
  readonly subgroupSegment: string;
  readonly itemSegment: string;
}

/**
 * Padrão estrutural XX.YY.ZZ (§17): YY="00" e ZZ="00" → Grupo; ZZ="00"
 * (YY≠"00") → Subgrupo; caso contrário → Item de Serviço. Genérico —
 * qualquer planilha orçamentária brasileira nesse formato, nunca uma regra
 * de um caso real específico.
 */
const HIERARCHICAL_CODE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{2})$/;

export function parseHierarchicalCode(code: string): HierarchicalCodeParse | null {
  const match = HIERARCHICAL_CODE_PATTERN.exec(code.trim());
  if (!match) return null;
  const [, groupSegment, subgroupSegment, itemSegment] = match;
  if (subgroupSegment === "00" && itemSegment === "00") return { level: "group", groupSegment, subgroupSegment, itemSegment };
  if (itemSegment === "00") return { level: "subgroup", groupSegment, subgroupSegment, itemSegment };
  return { level: "service_item", groupSegment, subgroupSegment, itemSegment };
}

const SUBTOTAL_TOTAL_LABELS = ["TOTAL GERAL", "TOTAL DO GRUPO", "TOTAL DO SUBGRUPO", "SUBTOTAL", "TOTAL"];

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

export interface LineCellValues {
  readonly externalCode: string | null;
  readonly description: string | null;
  readonly unit: string | null;
  readonly quantity: string | null;
  readonly unitPrice: string | null;
  readonly total: string | null;
}

export function extractCellValuesByRole(line: NeutralDocumentLine, roleByColumnOrder: ReadonlyMap<number, ColumnRoleAssignment>): LineCellValues {
  const byRole: Partial<Record<BudgetColumnRole, string>> = {};
  for (const position of line.positions) {
    if (position.status !== "cell_structured") continue;
    const assignment = roleByColumnOrder.get(position.columnOrder);
    if (assignment === undefined) continue;
    const text = cellVerbatimText(position);
    if (text === null) continue;
    if (byRole[assignment.role] === undefined) byRole[assignment.role] = text;
  }
  return {
    externalCode: byRole.external_code ?? null,
    description: byRole.description ?? null,
    unit: byRole.unit ?? null,
    quantity: byRole.quantity ?? null,
    unitPrice: byRole.unit_price ?? null,
    total: byRole.total ?? null,
  };
}

function lineHasAnyText(line: NeutralDocumentLine): boolean {
  return line.positions.some((position) => position.status === "cell_structured" && cellVerbatimText(position) !== null);
}

export interface RowClassificationResult {
  readonly type: ProposedLineType;
  readonly hierarchicalCode: HierarchicalCodeParse | null;
}

/**
 * Classifica uma linha em um dos dez tipos (§11.1), nesta ordem de
 * prioridade — nunca aparência visual isolada como confirmação suficiente:
 *
 * 1. estado upstream não processável/falho → not_processable;
 * 2. candidata a cabeçalho (repetida se já vista antes) → header/repeated_header;
 * 3. sem texto algum → empty;
 * 4. código externo casa com o padrão hierárquico → group/subgroup/service_item;
 * 5. célula de descrição casa com rótulo de subtotal/total conhecido → subtotal_or_total;
 * 6. descrição presente e ao menos um campo econômico (quantidade/preço/total)
 *    presente, sem código hierárquico → service_item sem código externo
 *    (ex.: COT-015) — a resolução do pai é decidida à parte, na construção
 *    da hierarquia, nunca aqui;
 * 7. algum texto presente sem nenhum padrão econômico → note;
 * 8. caso contrário → ambiguous.
 */
export function classifyRow(
  line: NeutralDocumentLine,
  cellValues: LineCellValues,
  seenHeaderSignatures: Set<string>,
): RowClassificationResult {
  if (line.status === "upstream_not_processable" || line.status === "failed") return { type: "not_processable", hierarchicalCode: null };

  if (isHeaderCandidateLine(line)) {
    const signature = line.positions
      .filter((p) => p.status === "cell_structured")
      .map((p) => (p.status === "cell_structured" ? normalize(cellVerbatimText(p) ?? "") : ""))
      .join("|");
    const isRepeat = seenHeaderSignatures.has(signature);
    seenHeaderSignatures.add(signature);
    return { type: isRepeat ? "repeated_header" : "header", hierarchicalCode: null };
  }

  if (!lineHasAnyText(line)) return { type: "empty", hierarchicalCode: null };

  if (cellValues.externalCode !== null) {
    const parsed = parseHierarchicalCode(cellValues.externalCode);
    if (parsed !== null) return { type: parsed.level === "group" ? "group" : parsed.level === "subgroup" ? "subgroup" : "service_item", hierarchicalCode: parsed };
  }

  const descriptionNormalized = cellValues.description !== null ? normalize(cellValues.description) : null;
  if (descriptionNormalized !== null && SUBTOTAL_TOTAL_LABELS.some((label) => descriptionNormalized === label || descriptionNormalized.startsWith(`${label} `))) {
    return { type: "subtotal_or_total", hierarchicalCode: null };
  }

  const hasEconomicField = cellValues.quantity !== null || cellValues.unitPrice !== null || cellValues.total !== null;
  if (cellValues.description !== null && hasEconomicField) return { type: "service_item", hierarchicalCode: null };

  if (cellValues.description !== null || cellValues.externalCode !== null) return { type: "note", hierarchicalCode: null };

  return { type: "ambiguous", hierarchicalCode: null };
}
