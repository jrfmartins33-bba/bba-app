import { Card } from "@bba/ui";
import type { BudgetDemonstrationData } from "@/lib/budget/budget-demonstration-data";

/**
 * Epic 21, Sprint 21.4B.1 (original) + 21.4B.3 (âncora `#comparacao`
 * restaurada -- "Ver comparação" nos cards de ação e o bloco final
 * navegam para cá; legenda de quadrados coloridos removida por
 * redundância, já que "Orçamento oficial"/"Valor da proposta" já são o
 * rótulo de cada barra, ao lado do valor -- a leitura nunca dependeu só
 * de cor). Duas barras horizontais com largura literal e pré-calculada
 * (`officialBarWidthPercent`/`proposalBarWidthPercent`, ver
 * budget-demonstration-data.ts) — o componente só aplica o número em
 * `style.width`, nunca recalcula a partir dos valores em centavos.
 */
export function BudgetComparisonSection({ data }: { readonly data: BudgetDemonstrationData }) {
  return (
    <div className="span-12" id="comparacao">
      <Card className="workspace-card" title="Orçamento oficial × proposta">
        <div className="budget-comparison">
          <div className="budget-comparison__row">
            <span className="budget-comparison__row-label">Orçamento oficial</span>
            <div className="budget-comparison__bar-track">
              <div
                className="budget-comparison__bar budget-comparison__bar--official"
                style={{ width: `${data.officialBarWidthPercent}%` }}
              />
            </div>
            <span className="budget-comparison__row-value">{data.officialBudget.displayValue}</span>
          </div>

          <div className="budget-comparison__row">
            <span className="budget-comparison__row-label">Valor da proposta</span>
            <div className="budget-comparison__bar-track">
              <div
                className="budget-comparison__bar budget-comparison__bar--proposal"
                style={{ width: `${data.proposalBarWidthPercent}%` }}
              />
            </div>
            <span className="budget-comparison__row-value">{data.proposalValue.displayValue}</span>
          </div>

          <div className="budget-comparison__summary">
            <span>
              Diferença: <strong>{data.differenceValue.displayValue}</strong>
            </span>
            <span>
              Redução: <strong>{data.reductionPercentDisplay}</strong>
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
