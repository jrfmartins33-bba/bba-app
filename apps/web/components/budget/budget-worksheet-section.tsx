"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@bba/ui";
import type { BudgetWorksheetGroup, BudgetWorksheetSample } from "@/lib/budget/budget-worksheet-sample-data";

/**
 * Epic 21, Sprint 21.4B.2 (original) + 21.4B.3 (grade fixa) + 21.4B.4
 * (uma única tabela para toda a planilha) — a Planilha orçamentária,
 * elemento principal da primeira experiência.
 *
 * 21.4B.3 tentou o alinhamento com uma `<table>` por grupo, todas
 * compartilhando o mesmo `<colgroup>`/`table-layout: fixed` -- correto
 * na teoria, mas cada `<table>` continua sendo um contexto de layout
 * independente do navegador; revisão visual real mostrou colunas
 * (Unidade/Quantidade/Preço unitário/Total) ainda ligeiramente
 * desalinhadas entre grupos, provavelmente por arredondamento de
 * porcentagem calculado separadamente em cada tabela. A única garantia
 * estrutural (não "deveria funcionar", mas "não pode deixar de
 * funcionar") é uma ÚNICA `<table>` para a planilha inteira: um só
 * `<colgroup>`, um só cálculo de largura de coluna, todos os grupos
 * como `<tbody>` dentro dela. Cada grupo continua expansível, mas via
 * `<button aria-expanded aria-controls>` em vez de `<details>` nativo
 * (que exigiria uma `<table>` por grupo para funcionar) -- ainda
 * totalmente operável por teclado, com foco visível.
 *
 * Nenhum valor é calculado aqui -- tudo já vem pronto de
 * `BUDGET_WORKSHEET_SAMPLE` (`sourceKind: "synthetic_visual_example"`,
 * ver budget-worksheet-sample-data.ts), inclusive o "Subtotal do
 * exemplo" de cada grupo. A contagem "N itens de exemplo em M grupos" é
 * sempre derivada de `sample`, nunca um literal duplicado.
 *
 * No desktop, uma tabela normal. Abaixo do breakpoint de 600px, a mesma
 * `<table>`/`<td>` vira layout de cartão via CSS (thead escondido,
 * `td::before` lê `data-label`) -- ver bba-globals.css.
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
          {sample.groups.map((group, index) => (
            <BudgetWorksheetGroupBody defaultOpen={index === 0} group={group} key={group.code} />
          ))}
        </table>
      </Card>
    </div>
  );
}

/**
 * Mesmo `<colgroup>` para a tabela inteira -- fonte única de verdade
 * para as proporções das seis colunas, calculada uma única vez pelo
 * navegador (nunca por grupo).
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

function BudgetWorksheetGroupBody({
  group,
  defaultOpen
}: {
  readonly group: BudgetWorksheetGroup;
  readonly defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <>
      <tbody>
        <tr className="budget-worksheet-table__group-header-row">
          <th colSpan={6} scope="rowgroup">
            <button
              aria-controls={contentId}
              aria-expanded={open}
              className="budget-worksheet-group__summary"
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              <span className="budget-worksheet-group__code">{group.code}</span>
              <span className="budget-worksheet-group__label">{group.label}</span>
              <span className="budget-worksheet-group__count">{group.items.length} itens</span>
              <ChevronDown
                aria-hidden="true"
                className={`budget-worksheet-group__chevron${open ? " budget-worksheet-group__chevron--open" : ""}`}
                size={18}
              />
            </button>
          </th>
        </tr>
      </tbody>
      {open ? (
        <tbody id={contentId}>
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
          <tr className="budget-worksheet-table__subtotal-row">
            <td className="budget-worksheet-table__subtotal-label" colSpan={5}>
              Subtotal do exemplo
            </td>
            <td className="budget-worksheet-table__numeric">{group.subtotalDisplay}</td>
          </tr>
        </tbody>
      ) : null}
    </>
  );
}
