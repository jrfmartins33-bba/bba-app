import type { BudgetDemonstrationData } from "@/lib/budget/budget-demonstration-data";

/**
 * Epic 21, Sprint 21.4B.2 (original) + 21.4B.3 (linha "Comparação
 * demonstrativa." removida -- a honestidade da demonstração já está
 * suficientemente comunicada pelo badge "Demonstração" e pelo aviso do
 * cabeçalho, mais o badge "Exemplo visual" e o aviso da planilha; um
 * quinto aviso aqui era repetição, não reforço). Substitui o antigo
 * card grande "Conclusão Executiva". Uma tira compacta de uma linha:
 * nenhum título institucional, nenhum painel interno, nenhuma caixa de
 * "Próxima ação" (essa ação vive só no bloco final, "Próximo passo").
 * Existe apenas para dar contexto textual rápido entre os indicadores e
 * a faixa de hierarquia -- os números em si já estão nos três cards
 * acima.
 */
export function BudgetSummaryStrip({ data }: { readonly data: BudgetDemonstrationData }) {
  return (
    <div className="span-12 budget-summary-strip">
      <p className="budget-summary-strip__headline">
        A proposta está <strong>{data.differenceValue.displayValue}</strong> abaixo do orçamento oficial, uma
        redução de <strong>{data.reductionPercentDisplay}</strong>.
      </p>
    </div>
  );
}
