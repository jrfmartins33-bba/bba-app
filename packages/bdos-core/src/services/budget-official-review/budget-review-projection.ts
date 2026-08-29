import { addBudgetLine, BudgetLineKind } from "../../domain/budget-version";
import type { BudgetVersion, BudgetVersionResult } from "../../domain/budget-version";
import { ACCEPTED_BUDGET_REVIEW_ROW_STATES, moneyCentsFromCanonicalDecimalText } from "../../domain/budget-official-review";
import type { BudgetReviewRow, BudgetReviewSession } from "../../domain/budget-official-review";
import type { ProcurementLot } from "../../domain/procurement-case";

// Correção Sprint 21.5A (Bloqueador A) — projeta as Linhas de Revisão já
// aprovadas (Confirmado/Corrigido/InseridoManualmente — nunca Pendente,
// nunca NaoPertenceAoOrcamento) de uma Sessão de Revisão para dentro de uma
// BudgetVersion já existente em Draft. Reutiliza addBudgetLine
// (packages/bdos-core/src/domain/budget-version) linha a linha — nunca
// reimplementa validação de hierarquia/posição/Escopo/total; apenas traduz
// o vocabulário de um domínio para o outro. `BudgetLine.id` reusa o próprio
// `BudgetReviewRow.id` (ambos UUIDs já únicos por sessão) — preserva a
// rastreabilidade sem precisar de uma tabela de mapeamento separada.
//
// Escopo de cada Linha projetada é exatamente o Escopo canônico da própria
// BudgetVersion. Quando esse Escopo é Lot, a projeção exige a prova de um
// ProcurementLot real e a repassa ao domínio em todas as linhas. Nunca cria
// um Lote a partir de `lotReference`: esse valor continua sendo apenas
// evidência/rótulo documental, preservado em metadata para apresentação.
//
// Uma linha só é projetada quando toda a sua cadeia de pais também está
// aprovada — um filho aprovado sob um pai Pendente/excluído nunca aparece
// órfão na Versão projetada (a árvore é percorrida a partir das raízes,
// nunca linha a linha isoladamente).

export function projectBudgetReviewSessionToBudgetVersion(
  session: BudgetReviewSession,
  budgetVersion: BudgetVersion,
  procurementLot?: ProcurementLot,
): BudgetVersionResult {
  let current = budgetVersion;

  for (const row of orderedProjectableChildren(session, null)) {
    const result = projectRowAndDescendants(session, row, current, procurementLot);
    if (!result.success) {
      return result;
    }
    current = result.budgetVersion;
  }

  return { success: true, budgetVersion: current, errors: [], warnings: [], metadata: current.metadata };
}

function projectRowAndDescendants(
  session: BudgetReviewSession,
  row: BudgetReviewRow,
  budgetVersion: BudgetVersion,
  procurementLot?: ProcurementLot,
): BudgetVersionResult {
  const addResult = addBudgetLine({
    budgetVersion,
    id: row.id,
    kind: row.kind,
    description:
      row.revised.description !== null
        ? { status: "Confirmed", text: row.revised.description }
        : { status: "AbsentFromSource" },
    externalCode: row.revised.itemCode,
    parentLineId: row.parentRowId,
    position: row.position,
    scope: budgetVersion.scope,
    procurementLot,
    totalCents: row.kind === BudgetLineKind.ServiceItem ? moneyCentsFromCanonicalDecimalText(row.revised.totalPriceText) : null,
    quantity: row.kind === BudgetLineKind.ServiceItem ? row.revised.quantityText : null,
    unit: row.kind === BudgetLineKind.ServiceItem ? row.revised.unit : null,
    unitPriceCents:
      row.kind === BudgetLineKind.ServiceItem ? moneyCentsFromCanonicalDecimalText(row.revised.unitPriceWithBdiText) : null,
    metadata: {
      lotReference: row.lotReference,
      sourcePage: row.page,
      reviewRowId: row.id,
      reviewSessionId: session.id,
      sourceEvidenceText: row.evidenceText,
      sourceUnitCostWithoutBdiText: row.revised.unitCostWithoutBdiText,
      sourceBdiPercentText: row.revised.bdiPercentText,
      sourceCalculationRule: row.calculationRule ?? null,
    },
  });

  if (!addResult.success) {
    return addResult;
  }

  let current = addResult.budgetVersion;

  for (const child of orderedProjectableChildren(session, row.id)) {
    const result = projectRowAndDescendants(session, child, current, procurementLot);
    if (!result.success) {
      return result;
    }
    current = result.budgetVersion;
  }

  return { success: true, budgetVersion: current, errors: [], warnings: [], metadata: current.metadata };
}

function orderedProjectableChildren(session: BudgetReviewSession, parentRowId: string | null): ReadonlyArray<BudgetReviewRow> {
  return session.rows
    .filter((row) => row.parentRowId === parentRowId && ACCEPTED_BUDGET_REVIEW_ROW_STATES.has(row.state))
    .slice()
    .sort((a, b) => a.position - b.position);
}
