import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from "lucide-react";
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
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.3 — elemento dominante
 * da página. Apresenta `executiveConclusion`/`situation` exatamente
 * como o Brief entrega -- nenhum headline/body é recomposto aqui, só
 * `readiness` é traduzido para o marcador de estado. O marcador
 * (rótulo curto) e o headline (frase do builder) tendem a dizer algo
 * parecido -- por isso têm pesos visuais diferentes (chip vs. título)
 * em vez de duas frases do mesmo tamanho.
 */
export function MeasurementDecisionHero({ situation, executiveConclusion, confidence }: MeasurementDecisionHeroProps) {
  const presentation = translateReadiness(executiveConclusion.readiness);
  const Icon = READINESS_ICON[presentation.icon];

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

        <div className="measurement-decision-hero__situation">
          <p className="measurement-decision-hero__situation-title">{situation.title}</p>
          <p className="measurement-decision-hero__situation-body">{situation.body}</p>
        </div>

        <p className="measurement-decision-hero__disclaimer">
          Esta conclusão representa a prontidão técnica da análise, anterior a qualquer aprovação humana.
        </p>

        <MeasurementConfidenceNote confidence={confidence} />
      </div>
    </Card>
  );
}
