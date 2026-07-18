import type { BudgetDemonstrationData } from "@/lib/budget/budget-demonstration-data";

/**
 * Epic 21, Sprint 21.4B.2 — faixa compacta "11 grupos → 25 subgrupos →
 * 300 itens de serviço", imediatamente acima da Planilha orçamentária.
 * Deliberadamente não é um Card com título -- é só uma tira de
 * contexto, não mais três cards adicionais (esses viviam antes nos
 * indicadores principais e foram removidos de lá nesta Sprint). Nunca
 * `aria-hidden` -- estas três contagens não aparecem em nenhum outro
 * ponto acessível da página, então precisam ser lidas normalmente.
 */
export function BudgetHierarchyStrip({ data }: { readonly data: BudgetDemonstrationData }) {
  return (
    <div className="span-12 budget-hierarchy-strip">
      <span className="budget-hierarchy-strip__node">{data.groupCount} grupos</span>
      <span className="budget-hierarchy-strip__arrow" aria-hidden="true">
        →
      </span>
      <span className="budget-hierarchy-strip__node">{data.subgroupCount} subgrupos</span>
      <span className="budget-hierarchy-strip__arrow" aria-hidden="true">
        →
      </span>
      <span className="budget-hierarchy-strip__node">{data.serviceItemCount} itens de serviço</span>
    </div>
  );
}
