import { Check, CircleDashed, Clock } from "lucide-react";
import { Card } from "@bba/ui";
import type { BudgetJourneyStep, BudgetJourneyStepState } from "@/lib/budget/budget-demonstration-data";

const STATE_ICON: Record<BudgetJourneyStepState, typeof Check> = {
  available: Check,
  awaiting_review: Clock,
  next_step: CircleDashed
};

const STATE_LABEL: Record<BudgetJourneyStepState, string> = {
  available: "Disponível",
  awaiting_review: "Aguardando revisão",
  next_step: "Próxima etapa"
};

/**
 * Epic 21, Sprint 21.4B.2 — "Etapas do orçamento" (renomeado de
 * "Caminho do orçamento"; vocabulário "Exige confirmação humana" /
 * "Demonstrado" / "Etapa futura" removido por completo -- nenhuma
 * ocorrência da palavra "humana" nesta experiência). Layout em grade de
 * 5 colunas no desktop (ver `.budget-journey` em bba-globals.css) —
 * cada etapa carrega o próprio estado, nunca inferido aqui; a distinção
 * nunca depende só de cor, sempre tem rótulo textual (`STATE_LABEL`).
 */
export function BudgetJourneySection({ journey }: { readonly journey: ReadonlyArray<BudgetJourneyStep> }) {
  return (
    <Card className="span-12 workspace-card" title="Etapas do orçamento">
      <ol className="budget-journey">
        {journey.map((step, index) => {
          const Icon = STATE_ICON[step.state];
          return (
            <li className={`budget-journey__step budget-journey__step--${step.state}`} key={step.id}>
              <span className="budget-journey__index" aria-hidden="true">
                {index + 1}
              </span>
              <p className="budget-journey__label">{step.label}</p>
              <span className="budget-journey__state">
                <Icon aria-hidden="true" size={12} />
                {STATE_LABEL[step.state]}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
