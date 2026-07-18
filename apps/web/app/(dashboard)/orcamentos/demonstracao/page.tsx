import { BUDGET_DEMONSTRATION_DATA } from "@/lib/budget/budget-demonstration-data";
import { BUDGET_WORKSHEET_SAMPLE } from "@/lib/budget/budget-worksheet-sample-data";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetSummaryStrip } from "@/components/budget/budget-summary-strip";
import { BudgetIndicatorCards } from "@/components/budget/budget-indicator-cards";
import { BudgetHierarchyStrip } from "@/components/budget/budget-hierarchy-strip";
import { BudgetWorksheetSection } from "@/components/budget/budget-worksheet-section";
import { BudgetComparisonSection } from "@/components/budget/budget-comparison-section";
import { BudgetJourneySection } from "@/components/budget/budget-journey-section";
import { BudgetActionCards } from "@/components/budget/budget-action-cards";
import { BudgetNextDecisionSection } from "@/components/budget/budget-next-decision-section";

/**
 * Epic 21, Sprint 21.4B.2 (original) + 21.4B.3 (acabamento comercial) —
 * primeira experiência visual e demonstrável da área de Orçamento.
 * Server Component fino: nenhum fetch, nenhuma lógica de decisão aqui —
 * toda a apresentação lê diretamente de
 * `BUDGET_DEMONSTRATION_DATA`/`BUDGET_WORKSHEET_SAMPLE` (fontes de
 * demonstração isoladas), exatamente como entregues.
 *
 * Ordem obrigatória (revisão visual da 21.4B.1 confirmou que o cliente
 * via um painel de números mas nenhuma planilha real -- corrigido
 * trazendo a Planilha orçamentária para antes da comparação e das
 * etapas, logo após o contexto compacto):
 * cabeçalho → resumo compacto → 3 indicadores → faixa 11→25→300 →
 * Planilha orçamentária (`#planilha-orcamentaria`) → comparação
 * (`#comparacao`) → etapas → ações → próximo passo.
 */
export default function OrcamentosDemonstracaoPage() {
  const data = BUDGET_DEMONSTRATION_DATA;
  const worksheet = BUDGET_WORKSHEET_SAMPLE;

  return (
    <>
      <BudgetPageHeader isDemonstration={data.sourceKind === "demonstration"} />

      <section className="section-grid">
        <BudgetSummaryStrip data={data} />
        <BudgetIndicatorCards data={data} />
        <BudgetHierarchyStrip data={data} />
        <BudgetWorksheetSection sample={worksheet} />
        <BudgetComparisonSection data={data} />
        <BudgetJourneySection journey={data.journey} />
        <BudgetActionCards simulationServiceAvailable={data.simulationServiceAvailable} />
        <BudgetNextDecisionSection />
      </section>
    </>
  );
}
