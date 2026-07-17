import { BUDGET_DEMONSTRATION_DATA } from "@/lib/budget/budget-demonstration-data";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetExecutiveConclusion } from "@/components/budget/budget-executive-conclusion";
import { BudgetIndicatorCards } from "@/components/budget/budget-indicator-cards";
import { BudgetComparisonSection } from "@/components/budget/budget-comparison-section";
import { BudgetJourneySection } from "@/components/budget/budget-journey-section";
import { BudgetStructureSection } from "@/components/budget/budget-structure-section";
import { BudgetActionCards } from "@/components/budget/budget-action-cards";
import { BudgetNextDecisionSection } from "@/components/budget/budget-next-decision-section";

/**
 * Epic 21, Sprint 21.4B.1 — primeira experiência visual e demonstrável
 * da área de Orçamento. Server Component fino: nenhum fetch, nenhuma
 * lógica de decisão aqui — toda a apresentação lê diretamente de
 * `BUDGET_DEMONSTRATION_DATA` (fonte de demonstração isolada, ver
 * budget-demonstration-data.ts), exatamente como entregue.
 */
export default function OrcamentosDemonstracaoPage() {
  const data = BUDGET_DEMONSTRATION_DATA;

  return (
    <>
      <BudgetPageHeader isDemonstration={data.sourceKind === "demonstration"} />

      <section className="section-grid">
        <BudgetExecutiveConclusion reductionPercentDisplay={data.reductionPercentDisplay} />
        <BudgetIndicatorCards data={data} />
        <div id="comparacao" className="span-12">
          <BudgetComparisonSection data={data} />
        </div>
        <BudgetJourneySection journey={data.journey} />
        <BudgetStructureSection data={data} />
        <BudgetActionCards simulationServiceAvailable={data.simulationServiceAvailable} />
        <BudgetNextDecisionSection />
      </section>
    </>
  );
}
