import type { BudgetDemonstrationData } from "@/lib/budget/budget-demonstration-data";

/**
 * Epic 21, Sprint 21.4B.2 — substitui o antigo card grande "Conclusão
 * Executiva". Uma tira compacta de no máximo duas linhas: nenhum título
 * institucional, nenhum painel interno, nenhuma caixa de "Próxima ação"
 * (essa ação vive só no bloco final, "Próxima decisão"). Existe apenas
 * para dar contexto textual rápido entre os indicadores e a faixa de
 * hierarquia -- os números em si já estão nos três cards acima.
 */
export function BudgetSummaryStrip({ data }: { readonly data: BudgetDemonstrationData }) {
  return (
    <div className="span-12 budget-summary-strip">
      <p className="budget-summary-strip__headline">
        A proposta está <strong>{data.differenceValue.displayValue}</strong> abaixo do orçamento oficial, uma
        redução de <strong>{data.reductionPercentDisplay}</strong>.
      </p>
      <p className="budget-summary-strip__meta">Comparação demonstrativa.</p>
    </div>
  );
}
