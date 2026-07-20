import type { NeutralDocumentLine, NeutralDocumentRegion } from "../budget-document-location/page-local-neutral-structured-evidence-formation/budget-document-page-local-neutral-structured-evidence-formation.types";
import type { BudgetColumnRole, ColumnRoleAssignment, ColumnRoleRecognitionOutcome } from "./budget-document-economic-characterization.types";

/**
 * Catálogo versionado de rótulos de cabeçalho (§15) — comparado apenas
 * contra texto normalizado (maiúsculas, sem acento, espaços colapsados),
 * nunca contra coordenadas, páginas ou valores específicos de um caso
 * real. Genérico o suficiente para qualquer planilha orçamentária
 * brasileira no padrão de código hierárquico XX.YY.ZZ, comum a diversos
 * sistemas públicos de referência de custos — nunca uma regra de um caso
 * real específico.
 *
 * `unit_price`/`total` reconhecem apenas a coluna FINAL (com BDI) como
 * papel canônico — uma coluna explicitamente qualificada "sem BDI"/"s/bdi"
 * é o custo-base pré-markup, uma evidência estrutural diferente, nunca
 * mapeada para o mesmo papel (evita conflito de papel entre duas colunas
 * genuinamente distintas, em vez de mascará-lo).
 */
function normalizeHeaderText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function recognizeRole(normalized: string): BudgetColumnRole | null {
  const preBdiCost = /S\/\s?BDI|SEM BDI/.test(normalized);
  if (/^(BDI|BDI\s?\(%\)|BDI%)$/.test(normalized)) return "bdi_percent";
  if (normalized === "TIPO") return "type_marker";
  if (normalized === "CODIGO" || normalized === "COD" || normalized === "ITEM") return "external_code";
  if (/DESCRI|ESPECIFICA/.test(normalized) || normalized === "SERVICO" || normalized === "SERVICOS") return "description";
  if (normalized === "UNID" || normalized === "UNIDADE" || normalized === "UND" || normalized === "UN") return "unit";
  if (/QUANT/.test(normalized) || normalized === "QTD" || normalized === "QTDE") return "quantity";
  if (/FONTE/.test(normalized)) return "source_reference";
  if (!preBdiCost && (/UNIT/.test(normalized) || /PRECO UNIT|CUSTO UNIT/.test(normalized)) && !/TOTAL/.test(normalized)) return "unit_price";
  if (!preBdiCost && (/TOTAL/.test(normalized) || /PRECO FINAL|VALOR FINAL/.test(normalized))) return "total";
  return null;
}

const MINIMUM_RECOGNIZED_ROLES_FOR_HEADER = 3;

/**
 * Uma linha é candidata a cabeçalho quando pelo menos
 * `MINIMUM_RECOGNIZED_ROLES_FOR_HEADER` das suas células, em posições
 * (`columnOrder`) distintas, casam com um papel do catálogo — nunca uma
 * única célula isolada, o que produziria falso positivo sobre uma célula
 * de conteúdo que coincidentemente contém a palavra "total".
 */
export function isHeaderCandidateLine(line: NeutralDocumentLine): boolean {
  const recognizedColumnOrders = new Set<number>();
  for (const position of line.positions) {
    if (position.status !== "cell_structured" || position.cell.status === "failed" || position.cell.sourceTextEvidence === null) continue;
    const text = cellVerbatimText(position);
    if (text === null) continue;
    if (recognizeRole(normalizeHeaderText(text)) !== null) recognizedColumnOrders.add(position.columnOrder);
  }
  return recognizedColumnOrders.size >= MINIMUM_RECOGNIZED_ROLES_FOR_HEADER;
}

/** Concatena, em ordem de origem, o texto verbatim resolvido de todos os fragmentos de uma célula — nunca corrige, nunca reordena além da ordem já publicada pela g.1/g.2. */
export function cellVerbatimText(position: Extract<NeutralDocumentLine["positions"][number], { status: "cell_structured" }>): string | null {
  if (position.cell.status === "failed" || position.cell.sourceTextEvidence === null) return null;
  const parts: string[] = [];
  for (const outcome of position.cell.sourceTextEvidence.segmentOutcomes) {
    if (outcome.status !== "resolved") continue;
    for (const fragment of outcome.fragments) parts.push(fragment.originalText);
  }
  const joined = parts.join(" ").trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Reconhece os papéis de coluna de uma região a partir da(s) linha(s)
 * candidatas a cabeçalho encontradas nela — nunca por posição/coordenada
 * fixa. Quando duas colunas distintas da mesma região reivindicam o mesmo
 * papel sem desempate estrutural (nenhuma delas está qualificada como
 * pré-BDI), o papel inteiro fica `ambiguous_role_conflict` — nunca uma
 * escolha silenciosa.
 */
export function recognizeColumnRoles(region: NeutralDocumentRegion): ColumnRoleRecognitionOutcome {
  const headerLines = region.documentLines.filter((line) => isHeaderCandidateLine(line));
  if (headerLines.length === 0) return { status: "no_header_found" };

  const roleByColumnOrder = new Map<number, ColumnRoleAssignment>();
  for (const line of headerLines) {
    for (const position of line.positions) {
      if (position.status !== "cell_structured") continue;
      const text = cellVerbatimText(position);
      if (text === null) continue;
      const normalized = normalizeHeaderText(text);
      const role = recognizeRole(normalized);
      if (role === null) continue;
      const existing = roleByColumnOrder.get(position.columnOrder);
      if (existing === undefined) {
        roleByColumnOrder.set(position.columnOrder, { columnOrder: position.columnOrder, role, observedHeaderLabel: text });
      }
    }
  }

  const roleToColumns = new Map<BudgetColumnRole, number[]>();
  for (const assignment of roleByColumnOrder.values()) {
    const list = roleToColumns.get(assignment.role) ?? [];
    list.push(assignment.columnOrder);
    roleToColumns.set(assignment.role, list);
  }
  for (const [role, columns] of roleToColumns) {
    if (columns.length > 1) {
      return { status: "ambiguous_role_conflict", conflictingColumnOrders: [...columns].sort((a, b) => a - b), role };
    }
  }

  return { status: "recognized", assignments: [...roleByColumnOrder.values()].sort((a, b) => a.columnOrder - b.columnOrder) };
}
