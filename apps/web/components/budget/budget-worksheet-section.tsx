"use client";

import { useState } from "react";
import { Card } from "@bba/ui";
import type { BudgetWorksheetGroup, BudgetWorksheetSample } from "@/lib/budget/budget-worksheet-sample-data";

/**
 * Epic 21, Sprint 21.4B.2 — a Planilha orçamentária, elemento principal
 * da primeira experiência (a revisão visual da 21.4B.1 apontou que o
 * cliente via um painel de números mas nenhuma planilha de verdade).
 * Nenhum valor é calculado aqui -- tudo já vem pronto de
 * `BUDGET_WORKSHEET_SAMPLE` (`sourceKind: "synthetic_visual_example"`,
 * ver budget-worksheet-sample-data.ts), inclusive o "Subtotal do
 * exemplo" de cada grupo.
 *
 * Tabela única (sem duplicar dado em dois markups): no desktop
 * `.budget-worksheet-table` renderiza como tabela normal; abaixo do
 * breakpoint de 600px, o mesmo `<table>`/`<td>` vira layout de cartão
 * via CSS (thead escondido, `td::before` lê `data-label`) -- ver
 * bba-globals.css.
 */
export function BudgetWorksheetSection({ sample }: { readonly sample: BudgetWorksheetSample }) {
  return (
    <div className="span-12" id="planilha-orcamentaria">
      <Card
        action={<span className="status-badge status-badge--pending">Exemplo visual</span>}
        className="workspace-card budget-worksheet"
        title="Planilha orçamentária"
      >
        <p className="workspace-card__description">Consulte como os grupos e itens serão apresentados na plataforma.</p>
        <p className="budget-worksheet__warning">
          Os itens e valores desta amostra são sintéticos e não compõem os totais apresentados no resumo.
        </p>

        <div className="budget-worksheet__groups">
          {sample.groups.map((group, index) => (
            <BudgetWorksheetGroupItem defaultOpen={index === 0} group={group} key={group.code} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function BudgetWorksheetGroupItem({
  group,
  defaultOpen
}: {
  readonly group: BudgetWorksheetGroup;
  readonly defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="budget-worksheet-group"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="budget-worksheet-group__summary">
        <span className="budget-worksheet-group__code">{group.code}</span>
        <span className="budget-worksheet-group__label">{group.label}</span>
        <span className="budget-worksheet-group__count">{group.items.length} itens</span>
      </summary>

      <table className="budget-worksheet-table">
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Item de serviço</th>
            <th scope="col">Unidade</th>
            <th className="budget-worksheet-table__numeric" scope="col">
              Quantidade
            </th>
            <th className="budget-worksheet-table__numeric" scope="col">
              Preço unitário
            </th>
            <th className="budget-worksheet-table__numeric" scope="col">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {group.items.map((item) => (
            <tr key={item.code}>
              <td data-label="Código">{item.code}</td>
              <td data-label="Item de serviço">{item.description}</td>
              <td data-label="Unidade">{item.unit}</td>
              <td className="budget-worksheet-table__numeric" data-label="Quantidade">
                {item.quantityDisplay}
              </td>
              <td className="budget-worksheet-table__numeric" data-label="Preço unitário">
                {item.unitPriceDisplay}
              </td>
              <td className="budget-worksheet-table__numeric" data-label="Total">
                {item.totalDisplay}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="budget-worksheet-group__subtotal">
        Subtotal do exemplo <strong>{group.subtotalDisplay}</strong>
      </p>
    </details>
  );
}
