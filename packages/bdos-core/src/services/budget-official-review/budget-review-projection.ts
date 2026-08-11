import { addBudgetLine, BudgetLineKind } from "../../domain/budget-version";
import type { BudgetVersion, BudgetVersionResult } from "../../domain/budget-version";
import { ACCEPTED_BUDGET_REVIEW_ROW_STATES, moneyCentsFromBrazilianText } from "../../domain/budget-official-review";
import type { BudgetReviewRow, BudgetReviewSession } from "../../domain/budget-official-review";

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
// Escopo de cada Linha projetada é sempre o mesmo Escopo da própria
// BudgetVersion (tipicamente WholeCase) — nunca um Escopo de Lote fabricado
// a partir de `lotReference` (que é apenas um rótulo textual da fonte, não
// prova de existência de um ProcurementLot real). `lotReference` é
// preservada em metadata, exatamente como a página já consumidora em
// apps/web/app/(dashboard)/orcamentos/page.tsx já espera
// (`line.metadata.lotReference`).
//
// Uma linha só é projetada quando toda a sua cadeia de pais também está
// aprovada — um filho aprovado sob um pai Pendente/excluído nunca aparece
// órfão na Versão projetada (a árvore é percorrida a partir das raízes,
// nunca linha a linha isoladamente).

export function projectBudgetReviewSessionToBudgetVersion(
  session: BudgetReviewSession,
  budgetVersion: BudgetVersion,
): BudgetVersionResult {
  let current = budgetVersion;

  for (const row of orderedProjectableChildren(session, null)) {
    const result = projectRowAndDescendants(session, row, current);
    if (!result.success) {
      return result;
    }
    current = result.budgetVersion;
  }

  return { success: true, budgetVersion: current, errors: [], warnings: [], metadata: current.metadata };
}

function projectRowAndDescendants(session: BudgetReviewSession, row: BudgetReviewRow, budgetVersion: BudgetVersion): BudgetVersionResult {
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
    totalCents: row.kind === BudgetLineKind.ServiceItem ? moneyCentsFromBrazilianText(row.revised.totalPriceText) : null,
    metadata: {
      lotReference: row.lotReference,
      sourcePage: row.page,
      reviewRowId: row.id,
      reviewSessionId: session.id,
      sourceEvidenceText: row.evidenceText,
    },
  });

  if (!addResult.success) {
    return addResult;
  }

  let current = addResult.budgetVersion;

  for (const child of orderedProjectableChildren(session, row.id)) {
    const result = projectRowAndDescendants(session, child, current);
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
