import { Card } from "@bba/ui";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";
import { translateReadiness } from "./measurement-decision-hero-view-model";

export interface MeasurementDecisionFlowSectionProps {
  readonly readiness: DecisionBrief["executiveConclusion"]["readiness"];
  readonly criticalItems: DecisionBrief["criticalItems"];
  readonly nextActions: DecisionBrief["nextActions"];
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.6 (padrão visual
 * human-first, PRINCIPLE 008 -- segunda iteração, protótipo validado
 * com a fixture real do BM_08) — resume visualmente o mesmo raciocínio
 * que já sustenta o Hero, como uma sequência de 4 estados em vez de
 * texto corrido. Cada passo é Categoria B: a mesma contagem de
 * `severity === "warning"` que `MeasurementDecisionHero`/
 * `buildKeyMetrics` já usam, `nextActions.length`, e `readiness`
 * traduzido pelo mesmo `translateReadiness` do Hero -- nenhum dado
 * novo, nenhuma etapa do pipeline é inventada (nunca afirma "toda a
 * planilha foi lida" ou qualquer cobertura que o contrato não
 * garanta).
 */
export function MeasurementDecisionFlowSection({ readiness, criticalItems, nextActions }: MeasurementDecisionFlowSectionProps) {
  const attentionCount = criticalItems.filter((item) => item.severity === "warning").length;
  const presentation = translateReadiness(readiness);

  return (
    <Card className="span-12 workspace-card" title="Como chegamos aqui">
      <div className="measurement-decision-flow">
        <span className="measurement-decision-flow__step">Análise concluída</span>
        <span aria-hidden="true" className="measurement-decision-flow__arrow">
          →
        </span>
        <span className="measurement-decision-flow__step measurement-decision-flow__step--warn">
          {attentionCount} {attentionCount === 1 ? "ponto de atenção" : "pontos de atenção"}
        </span>
        <span aria-hidden="true" className="measurement-decision-flow__arrow">
          →
        </span>
        <span className="measurement-decision-flow__step measurement-decision-flow__step--gold">
          {nextActions.length} {nextActions.length === 1 ? "ação recomendada" : "ações recomendadas"}
        </span>
        <span aria-hidden="true" className="measurement-decision-flow__arrow">
          →
        </span>
        <span className={`measurement-decision-flow__step measurement-decision-flow__step--result-${presentation.tone}`}>{presentation.label}</span>
      </div>
    </Card>
  );
}
