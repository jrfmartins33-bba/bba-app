"use client";

import { Card } from "@bba/ui";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";
import { translateReadiness } from "./measurement-decision-hero-view-model";
import { MEASUREMENT_CERTIFICATION_READY_LABEL, useMeasurementCertificationReady } from "./use-measurement-certification-ready";

export interface MeasurementDecisionFlowSectionProps {
  readonly readiness: DecisionBrief["executiveConclusion"]["readiness"];
  readonly criticalItems: DecisionBrief["criticalItems"];
  readonly nextActions: DecisionBrief["nextActions"];
  /** Mesma leitura compartilhada com o Hero -- ver useMeasurementCertificationReady. */
  readonly measurementBulletinImportId: string;
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.6 (padrão visual
 * human-first, PRINCIPLE 008 -- segunda iteração, protótipo validado
 * com a fixture real do BM_08) + ajuste de coerência visual pós-
 * refinamento de materialidade — resume visualmente o mesmo
 * raciocínio que já sustenta o Hero, como uma sequência de 4 estados
 * em vez de texto corrido. Cada passo é Categoria B: nenhum dado
 * novo, nenhuma etapa do pipeline é inventada.
 *
 * O segundo passo usa `item.materiality`, não `severity` bruto --
 * quando não há nenhuma divergência material (só observações
 * técnicas de leitura), o passo mostra "observações técnicas" em vez
 * de "pontos de atenção"; havendo qualquer divergência material real,
 * continua mostrando "pontos de atenção" normalmente. O passo final
 * reaproveita o mesmo `useMeasurementCertificationReady` do Hero --
 * os dois nunca podem divergir sobre quando promover para "Pronta
 * para certificação".
 */
export function MeasurementDecisionFlowSection({
  readiness,
  criticalItems,
  nextActions,
  measurementBulletinImportId
}: MeasurementDecisionFlowSectionProps) {
  const materialWarningCount = criticalItems.filter((item) => item.severity === "warning" && item.materiality === "material").length;
  const technicalObservationCount = criticalItems.filter((item) => item.materiality === "technical_observation").length;
  const presentation = translateReadiness(readiness);
  const certificationReady = useMeasurementCertificationReady(readiness, measurementBulletinImportId);

  const showTechnicalObservationStep = materialWarningCount === 0 && technicalObservationCount > 0;
  const secondStepLabel = showTechnicalObservationStep
    ? `${technicalObservationCount} ${technicalObservationCount === 1 ? "observação técnica" : "observações técnicas"}`
    : `${materialWarningCount} ${materialWarningCount === 1 ? "ponto de atenção" : "pontos de atenção"}`;
  const secondStepClass = showTechnicalObservationStep
    ? "measurement-decision-flow__step--technical"
    : "measurement-decision-flow__step--warn";

  const finalStepLabel = certificationReady ? MEASUREMENT_CERTIFICATION_READY_LABEL : presentation.label;
  const finalStepTone = certificationReady ? "positive" : presentation.tone;

  return (
    <Card className="span-12 workspace-card" title="Como chegamos aqui">
      <div className="measurement-decision-flow">
        <span className="measurement-decision-flow__step">Análise concluída</span>
        <span aria-hidden="true" className="measurement-decision-flow__arrow">
          →
        </span>
        <span className={`measurement-decision-flow__step ${secondStepClass}`}>{secondStepLabel}</span>
        <span aria-hidden="true" className="measurement-decision-flow__arrow">
          →
        </span>
        <span className="measurement-decision-flow__step measurement-decision-flow__step--gold">
          {nextActions.length} {nextActions.length === 1 ? "ação recomendada" : "ações recomendadas"}
        </span>
        <span aria-hidden="true" className="measurement-decision-flow__arrow">
          →
        </span>
        <span className={`measurement-decision-flow__step measurement-decision-flow__step--result-${finalStepTone}`}>{finalStepLabel}</span>
      </div>
    </Card>
  );
}
