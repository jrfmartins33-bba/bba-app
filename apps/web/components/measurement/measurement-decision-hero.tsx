"use client";

import { ArrowRight, CircleCheck, CircleHelp, CircleX, ListChecks, ShieldCheck, TriangleAlert } from "lucide-react";
import { Card } from "@bba/ui";
import type { DecisionBrief, ReliabilityIndexResult } from "@bba/bdos-core/decision-brief";
import { MeasurementConfidenceNote } from "./measurement-confidence-note";
import { translateReadiness, type ReadinessIcon } from "./measurement-decision-hero-view-model";
import { MEASUREMENT_CERTIFICATION_READY_LABEL, useMeasurementCertificationReady } from "./use-measurement-certification-ready";

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
  /**
   * Refinamento pós-3C.2 -- exclusivo para a checagem opcional de
   * estado formal real (ver `certificationReadyHeadline` abaixo). O
   * Brief em si (readiness/headline/body) nunca depende disto -- este
   * id só entra numa segunda leitura, somente-leitura, do estado já
   * persistido do boletim formal (Etapa 3C.1C/3C.2), inteiramente
   * separada da análise técnica.
   */
  readonly measurementBulletinImportId: string;
}

// Etapa 3C.2 -- só promove o headline/body de "análise limpa" para a
// linguagem de certificação quando o estado formal REAL confirma isso
// (boletim Finalized, ainda não certificado). O builder (puro, sem
// I/O) nunca sabe se um boletim formal existe -- essa composição só
// pode acontecer aqui, na fronteira que já lê os dois lados. A
// checagem em si vive em useMeasurementCertificationReady, compartilhado
// com MeasurementDecisionFlowSection para que os dois nunca divirjam.
const CERTIFICATION_READY_HEADLINE = "Medição conferida e pronta para certificação.";
const CERTIFICATION_READY_BODY =
  "Os valores e itens medidos foram reconciliados sem divergências. As observações técnicas de leitura do arquivo não têm impacto sobre o valor ou a rastreabilidade da medição.";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.3 (original) + 20.1E.6
 * (padrão visual human-first, PRINCIPLE 008) + refinamento pós-3C.2
 * (materialidade + estado formal) — elemento dominante da página.
 * Apresenta `executiveConclusion`/`situation` como o Brief entrega --
 * só o par headline/body é substituído, e só quando readiness="ready"
 * E o estado formal real (lido à parte, nunca calculado aqui) confirma
 * Finalized/não certificado; nenhum outro caso é afetado.
 *
 * Os dois números de risco (Impedimentos bloqueantes / Divergências
 * materiais) usam `item.materiality`, não `severity` bruto -- um
 * `warning` classificado como observação técnica nunca conta como
 * divergência material (essa é exatamente a correção desta rodada).
 * "Observações técnicas" é mostrado separadamente, fora da faixa de
 * risco, com tratamento visual neutro -- nunca no mesmo tom de alerta.
 */
export function MeasurementDecisionHero({
  situation,
  executiveConclusion,
  confidence,
  criticalItems,
  nextActions,
  measurementBulletinImportId
}: MeasurementDecisionHeroProps) {
  const presentation = translateReadiness(executiveConclusion.readiness);
  const Icon = READINESS_ICON[presentation.icon];
  const blockingCount = criticalItems.filter((item) => item.severity === "blocking").length;
  const materialWarningCount = criticalItems.filter((item) => item.severity === "warning" && item.materiality === "material").length;
  const technicalObservationCount = criticalItems.filter((item) => item.materiality === "technical_observation").length;
  const firstAction = nextActions[0] ?? null;

  const certificationReady = useMeasurementCertificationReady(executiveConclusion.readiness, measurementBulletinImportId);

  const headline = certificationReady ? CERTIFICATION_READY_HEADLINE : executiveConclusion.headline;
  const body = certificationReady ? CERTIFICATION_READY_BODY : executiveConclusion.body;
  const markerLabel = certificationReady ? MEASUREMENT_CERTIFICATION_READY_LABEL : presentation.label;

  return (
    <Card className={`span-12 workspace-card measurement-decision-hero measurement-decision-hero--${presentation.tone}`}>
      <div className="measurement-decision-hero__content">
        <span className="workspaces-eyebrow">Conclusão Executiva</span>

        <div className="measurement-decision-hero__marker">
          <Icon aria-hidden="true" size={18} />
          <span>{markerLabel}</span>
        </div>

        <h2 className="measurement-decision-hero__headline">{headline}</h2>
        <p className="measurement-decision-hero__body">{body}</p>

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
              <span className="measurement-decision-hero__stat-value">{materialWarningCount}</span>
              <span className="measurement-decision-hero__stat-label">Divergências materiais</span>
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

        {technicalObservationCount > 0 ? (
          <p className="measurement-decision-hero__technical-observations">
            <CircleCheck aria-hidden="true" size={14} />
            {technicalObservationCount} {technicalObservationCount === 1 ? "observação técnica" : "observações técnicas"} — sem impacto no valor ou na rastreabilidade
          </p>
        ) : null}

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
