import { Check, CircleDashed, Clock } from "lucide-react";
import { Card } from "@bba/ui";
import type { BudgetJourneyStep, BudgetJourneyStepState } from "@/lib/budget/budget-demonstration-data";

const STATE_ICON: Record<BudgetJourneyStepState, typeof Check> = {
  demonstrated: Check,
  requires_confirmation: Clock,
  future: CircleDashed
};

const STATE_LABEL: Record<BudgetJourneyStepState, string> = {
  demonstrated: "Demonstrado",
  requires_confirmation: "Exige confirmação humana",
  future: "Etapa futura"
};

/**
 * Epic 21, Sprint 21.4B.1 — "Caminho do orçamento". Cada etapa carrega o
 * próprio estado (`demonstrated` | `requires_confirmation` | `future`),
 * nunca inferido aqui — a distinção nunca depende só de cor, sempre tem
 * rótulo textual (`STATE_LABEL`).
 */
export function BudgetJourneySection({ journey }: { readonly journey: ReadonlyArray<BudgetJourneyStep> }) {
  return (
    <Card className="span-12 workspace-card" title="Caminho do orçamento">
      <ol className="budget-journey">
        {journey.map((step, index) => {
          const Icon = STATE_ICON[step.state];
          return (
            <li className={`budget-journey__step budget-journey__step--${step.state}`} key={step.id}>
              <span className="budget-journey__index" aria-hidden="true">
                {index + 1}
              </span>
              <div className="budget-journey__body">
                <p className="budget-journey__label">{step.label}</p>
                <span className="budget-journey__state">
                  <Icon aria-hidden="true" size={14} />
                  {STATE_LABEL[step.state]}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
