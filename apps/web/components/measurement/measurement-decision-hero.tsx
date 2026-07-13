import { ArrowRight, CircleCheck, CircleHelp, CircleX, ListChecks, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card } from "@bba/ui";
import type { DecisionBrief, ReliabilityIndexResult } from "@bba/bdos-core/decision-brief";
import { MeasurementConfidenceNote } from "./measurement-confidence-note";
import { translateReadiness, type ReadinessIcon } from "./measurement-decision-hero-view-model";

const READINESS_ICON: Record<ReadinessIcon, typeof CircleCheck> = {
  check: CircleCheck,
  alert: TriangleAlert,
  cross: CircleX,
  help: CircleHelp
};

export interface MeasurementDecisionHeroProps {
  readonly situation: DecisionBrief["situation"];
  readonly executiveConclusion: DecisionBrief["executiveConclusion"];
  readonly confidence: ReliabilityIndexResult;
  readonly criticalItems: DecisionBrief["criticalItems"];
  readonly nextActions: DecisionBrief["nextActions"];
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.3 (original) + 20.1E.6
 * (padrão visual human-first, PRINCIPLE 008 -- segunda iteração, após
 * protótipo validado com a fixture real do BM_08) — elemento
 * dominante da página. Apresenta `executiveConclusion`/`situation`
 * exatamente como o Brief entrega -- nenhum headline/body é recomposto
 * aqui, só `readiness` é traduzido para o marcador de estado.
 *
 * Os três números (Impedimentos bloqueantes / Pontos de atenção /
 * Ações recomendadas) usam a MESMA distinção de severidade que o
 * builder já usa para `keyMetrics` (`buildKeyMetrics`,
 * measurement-decision-brief-builder.ts): bloqueantes conta só
 * `severity === "blocking"`, pontos de atenção conta só
 * `severity === "warning"` -- nunca `criticalItems.length` bruto, que
 * confundiria as duas contagens sempre que existir pelo menos um item
 * bloqueante. "Próximo passo" usa `nextActions[0]` verbatim (primeira
 * ação real, nunca escolhida por peso/prioridade -- o contrato não
 * tem esse campo); omitido quando `nextActions` está vazio.
 */
export function MeasurementDecisionHero({ situation, executiveConclusion, confidence, criticalItems, nextActions }: MeasurementDecisionHeroProps) {
  const presentation = translateReadiness(executiveConclusion.readiness);
  const Icon = READINESS_ICON[presentation.icon];
  const blockingCount = criticalItems.filter((item) => item.severity === "blocking").length;
  const attentionCount = criticalItems.filter((item) => item.severity === "warning").length;
  const firstAction = nextActions[0] ?? null;

  return (
    <Card className={`span-12 workspace-card measurement-decision-hero measurement-decision-hero--${presentation.tone}`}>
      <div className="measurement-decision-hero__content">
        <span className="workspaces-eyebrow">Conclusão Executiva</span>

        <div className="measurement-decision-hero__marker">
          <Icon aria-hidden="true" size={18} />
          <span>{presentation.label}</span>
        </div>

        <h2 className="measurement-decision-hero__headline">{executiveConclusion.headline}</h2>
        <p className="measurement-decision-hero__body">{executiveConclusion.body}</p>

        <div className="measurement-decision-hero__stats">
          <div className="measurement-decision-hero__stat measurement-decision-hero__stat--ok">
            <span aria-hidden="true" className="measurement-decision-hero__stat-icon">
              <ShieldCheck size={20} />
            </span>
            <span className="measurement-decision-hero__stat-body">
              <span className="measurement-decision-hero__stat-value">{blockingCount}</span>
              <span className="measurement-decision-hero__stat-label">Impedimentos bloqueantes</span>
            </span>
          </div>
          <div className="measurement-decision-hero__stat measurement-decision-hero__stat--warn">
            <span aria-hidden="true" className="measurement-decision-hero__stat-icon">
              <TriangleAlert size={20} />
            </span>
            <span className="measurement-decision-hero__stat-body">
              <span className="measurement-decision-hero__stat-value">{attentionCount}</span>
              <span className="measurement-decision-hero__stat-label">Pontos de atenção</span>
            </span>
          </div>
          <div className="measurement-decision-hero__stat measurement-decision-hero__stat--gold">
            <span aria-hidden="true" className="measurement-decision-hero__stat-icon">
              <ListChecks size={20} />
            </span>
            <span className="measurement-decision-hero__stat-body">
              <span className="measurement-decision-hero__stat-value">{nextActions.length}</span>
              <span className="measurement-decision-hero__stat-label">Ações recomendadas</span>
            </span>
          </div>
        </div>

        {firstAction !== null ? (
          <div className="measurement-decision-hero__next-step">
            <span aria-hidden="true" className="measurement-decision-hero__next-step-icon">
              <ArrowRight size={16} />
            </span>
            <div className="measurement-decision-hero__next-step-body">
              <span>Próximo passo</span>
              <p>{firstAction.title}</p>
            </div>
          </div>
        ) : null}

        <div className="measurement-decision-hero__foot">
          <div className="measurement-decision-hero__situation">
            <p className="measurement-decision-hero__situation-title">{situation.title}</p>
            <p className="measurement-decision-hero__situation-body">{situation.body}</p>
          </div>

          <MeasurementConfidenceNote confidence={confidence} />
        </div>

        <p className="measurement-decision-hero__disclaimer">
          Esta conclusão representa a prontidão técnica da análise, anterior a qualquer aprovação humana.
        </p>
      </div>
    </Card>
  );
}
