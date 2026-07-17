import { Boxes, Layers, ListChecks, TrendingDown, Wallet, Wallet2 } from "lucide-react";
import { Card } from "@bba/ui";
import type { BudgetDemonstrationData } from "@/lib/budget/budget-demonstration-data";

/**
 * Epic 21, Sprint 21.4B.1 — os seis indicadores principais. Cada card
 * mostra só o valor já pronto (`displayValue`/contagem inteira) recebido
 * de `BudgetDemonstrationData` — nenhuma soma, divisão ou formatação
 * acontece aqui.
 */
export function BudgetIndicatorCards({ data }: { readonly data: BudgetDemonstrationData }) {
  const indicators = [
    { id: "oficial", label: "Orçamento oficial", value: data.officialBudget.displayValue, icon: Wallet },
    { id: "proposta", label: "Valor da proposta", value: data.proposalValue.displayValue, icon: Wallet2 },
    { id: "reducao", label: "Redução proposta", value: data.reductionPercentDisplay, icon: TrendingDown },
    { id: "grupos", label: "Grupos", value: String(data.groupCount), icon: Boxes },
    { id: "subgrupos", label: "Subgrupos", value: String(data.subgroupCount), icon: Layers },
    { id: "itens", label: "Itens de serviço", value: String(data.serviceItemCount), icon: ListChecks }
  ] as const;

  return (
    <>
      {indicators.map((indicator) => {
        const Icon = indicator.icon;
        return (
          <Card className="span-4 workspace-card budget-indicator-card" key={indicator.id}>
            <div className="metric">
              <span className="metric__icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <div>
                <strong>{indicator.value}</strong>
                <span>{indicator.label}</span>
              </div>
            </div>
          </Card>
        );
      })}
    </>
  );
}
