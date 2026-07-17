import { ArrowRight, CircleCheck } from "lucide-react";
import { Card } from "@bba/ui";

/**
 * Epic 21, Sprint 21.4B.1 — resposta imediata (Situação / Conclusão /
 * Próxima ação), mesmo princípio do Decision Hero de Medições
 * (measurement-decision-hero.tsx): a primeira área da tela nunca deixa o
 * cliente sem saber onde está e o que fazer a seguir. `reductionPercentDisplay`
 * é renderizado exatamente como recebido — nenhum cálculo aqui.
 */
export function BudgetExecutiveConclusion({ reductionPercentDisplay }: { readonly reductionPercentDisplay: string }) {
  return (
    <Card className="span-12 workspace-card budget-hero">
      <span className="workspaces-eyebrow">Conclusão Executiva</span>

      <div className="budget-hero__marker">
        <CircleCheck aria-hidden="true" size={18} />
        <span>Orçamento organizado para análise</span>
      </div>

      <p className="budget-hero__label">Conclusão</p>
      <h2 className="budget-hero__headline">
        A proposta representa uma redução de {reductionPercentDisplay} em relação ao orçamento oficial.
      </h2>

      <div className="budget-hero__next-step">
        <span aria-hidden="true" className="budget-hero__next-step-icon">
          <ArrowRight size={16} />
        </span>
        <div className="budget-hero__next-step-body">
          <span>Próxima ação</span>
          <p>Revise a comparação e explore como os itens estão organizados.</p>
        </div>
      </div>
    </Card>
  );
}
