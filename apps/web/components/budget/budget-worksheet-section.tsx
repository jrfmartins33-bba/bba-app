"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@bba/ui";
import type { BudgetWorksheetGroup, BudgetWorksheetSample } from "@/lib/budget/budget-worksheet-sample-data";

/**
 * Epic 21, Sprint 21.4B.2 (original) + 21.4B.3 (grade fixa entre grupos,
 * subtotal em `<tfoot>`, contagem da amostra) — a Planilha orçamentária,
 * elemento principal da primeira experiência. Nenhum valor é calculado
 * aqui -- tudo já vem pronto de `BUDGET_WORKSHEET_SAMPLE` (`sourceKind:
 * "synthetic_visual_example"`, ver budget-worksheet-sample-data.ts),
 * inclusive o "Subtotal do exemplo" de cada grupo. A contagem "N itens
 * de exemplo em M grupos" é sempre derivada de `sample`, nunca um
 * literal duplicado.
 *
 * Tabela única por grupo (sem duplicar dado em dois markups): no
 * desktop `.budget-worksheet-table` renderiza como tabela normal, com
 * `table-layout: fixed` e o MESMO `<colgroup>` em toda tabela -- é isso
 * (não `text-align` isolado) que mantém Quantidade/Preço
 * unitário/Total alinhados verticalmente entre os três grupos, já que
 * cada `<table>` é, de outra forma, um contexto de layout independente
 * do navegador. Abaixo do breakpoint de 600px, o mesmo `<table>`/`<td>`
 * vira layout de cartão via CSS (thead escondido, `td::before` lê
 * `data-label`) -- ver bba-globals.css.
 */
export function BudgetWorksheetSection({ sample }: { readonly sample: BudgetWorksheetSample }) {
  const totalItems = sample.groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <div className="span-12" id="planilha-orcamentaria">
      <Card
        action={<span className="status-badge status-badge--pending">Exemplo visual</span>}
        className="workspace-card budget-worksheet"
        title="Planilha orçamentária"
      >
        <p className="workspace-card__description">Consulte como os grupos e itens serão apresentados na plataforma.</p>
        <p className="budget-worksheet__sample-size">
          {totalItems} itens de exemplo em {sample.groups.length} grupos
        </p>
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

/**
 * Mesmo `<colgroup>` em toda tabela -- fonte única de verdade para as
 * proporções das seis colunas, nunca copiado manualmente entre grupos
 * (cada tabela vem desta mesma função, chamada uma vez por grupo).
 */
function BudgetWorksheetColgroup() {
  return (
    <colgroup>
      <col style={{ width: "9%" }} />
      <col style={{ width: "33%" }} />
      <col style={{ width: "10%" }} />
      <col style={{ width: "12%" }} />
      <col style={{ width: "18%" }} />
      <col style={{ width: "18%" }} />
    </colgroup>
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
        <ChevronDown aria-hidden="true" className="budget-worksheet-group__chevron" size={18} />
      </summary>

      <table className="budget-worksheet-table">
        <BudgetWorksheetColgroup />
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Item de serviço</th>
            <th className="budget-worksheet-table__unit" scope="col">
              Unidade
            </th>
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
              <td className="budget-worksheet-table__description" data-label="Item de serviço">
                {item.description}
              </td>
              <td className="budget-worksheet-table__unit" data-label="Unidade">
                {item.unit}
              </td>
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
        <tfoot>
          <tr className="budget-worksheet-table__subtotal-row">
            <td className="budget-worksheet-table__subtotal-label" colSpan={5}>
              Subtotal do exemplo
            </td>
            <td className="budget-worksheet-table__numeric">{group.subtotalDisplay}</td>
          </tr>
        </tfoot>
      </table>
    </details>
  );
}
