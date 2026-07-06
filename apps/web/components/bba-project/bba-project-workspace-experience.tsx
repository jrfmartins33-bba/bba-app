"use client";

import { useRef, useState, type RefObject } from "react";
import { Clock, FileUp, Sparkles, TimerReset, TriangleAlert, UploadCloud } from "lucide-react";
import { Card, ProgressBar } from "@bba/ui";
import { activityIdFromSpatialObjectId, spatialObjectIdForActivity } from "./bba-project-ids";
import {
  activityIdFromDecision,
  buildAdvisorNarrative,
  buildHeroNarrative,
  buildReasoningChain,
  computeHealthScore
} from "./bba-project-insights";
import { BbaProjectHero } from "./bba-project-hero";
import { BbaProjectExecutiveCards, type ExecutiveCardsData } from "./bba-project-executive-cards";
import { BbaProjectAdvisorNarrative } from "./bba-project-advisor-narrative";
import { BbaProjectSpatialModel, deriveSpatialModelStatus, type SpatialModelObject } from "./bba-project-spatial-model";
import { BbaProjectScheduleTable } from "./bba-project-schedule-table";
import { BbaProjectRiskList, type RiskListItem } from "./bba-project-risk-list";
import { BbaProjectReasoningChain } from "./bba-project-reasoning-chain";
import type { BbaProjectPlanningActivity, BbaProjectSnapshot } from "./bba-project-view-types";

/**
 * BBA Project Studio — Sprint 2 (EPIC 02, Decision First Experience,
 * ver `packages/bdos-core/docs/BBA_PROJECT.md`). Único componente com
 * estado desta tela. Nenhum cálculo do BDOS acontece aqui — este
 * componente só envia o arquivo para `/api/bba-project/import` e
 * apresenta o snapshot já pronto. Esta sprint é exclusivamente de
 * experiência: a decisão aparece primeiro, o cronograma passa a
 * explicá-la.
 */
const PROCESSING_STEPS = [
  "Lendo arquivo...",
  "Identificando estrutura de planejamento...",
  "Conectando ao mapa...",
  "Avaliando confiança espacial...",
  "Gerando recomendações..."
];

const STEP_DURATION_MS = 650;

const PLANNING_TYPE_LABELS: Record<string, string> = {
  cronograma: "Cronograma",
  "curva-s": "Curva S",
  "fisico-financeiro": "Cronograma Físico-Financeiro",
  mixed: "Dados mistos",
  unknown: "Não identificado"
};

const LIMITATION_NOTICE =
  "Alguns dados não estavam explícitos no arquivo de origem. O BBA Project Studio importou o que pôde reconhecer sem inventar informações.";

type EntryChoice = "pending" | "chosen";
type Phase = "idle" | "processing" | "ready" | "error";

interface DelaySimulation {
  readonly projectDurationDays: number;
  readonly criticalActivityCount: number;
  readonly hasDependencies: boolean;
}

export function BbaProjectWorkspaceExperience() {
  const [entryChoice, setEntryChoice] = useState<EntryChoice>("pending");
  const [phase, setPhase] = useState<Phase>("idle");
  const [processingStepIndex, setProcessingStepIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<BbaProjectSnapshot | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [delaySimulation, setDelaySimulation] = useState<DelaySimulation | null>(null);
  const [simulatingDelay, setSimulatingDelay] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const advisorRef = useRef<HTMLDivElement | null>(null);

  async function runImport(file: File) {
    setPhase("processing");
    setProcessingStepIndex(0);
    setErrorMessage(null);
    setDelaySimulation(null);

    const stepTimer = window.setInterval(() => {
      setProcessingStepIndex((current) => Math.min(current + 1, PROCESSING_STEPS.length - 1));
    }, STEP_DURATION_MS);

    const minimumDisplay = wait(PROCESSING_STEPS.length * STEP_DURATION_MS);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const [response] = await Promise.all([fetch("/api/bba-project/import", { method: "POST", body: formData }), minimumDisplay]);

      const result = (await response.json()) as BbaProjectSnapshot;

      if (!response.ok || result.planningDataset.activities.length === 0) {
        setPhase("error");
        setErrorMessage(
          "Não foi possível reconhecer nenhum item de planejamento neste arquivo. Verifique se é uma exportação XML do Microsoft Project ou uma planilha Excel de cronograma/curva S/físico-financeiro."
        );
        return;
      }

      setSnapshot(result);
      setSelectedActivityId(firstAtRiskActivityId(result));
      setPhase("ready");
    } catch {
      setPhase("error");
      setErrorMessage("Falha de comunicação ao importar o arquivo.");
    } finally {
      window.clearInterval(stepTimer);
    }
  }

  async function handleChooseDemo() {
    setEntryChoice("chosen");
    const response = await fetch("/samples/cronograma-exemplo.xml");
    const xmlText = await response.text();
    await runImport(new File([xmlText], "cronograma-exemplo.xml", { type: "text/xml" }));
  }

  function handleChooseImport() {
    setEntryChoice("chosen");
  }

  async function handleSimulateDelay(activity: BbaProjectPlanningActivity) {
    if (snapshot === null) {
      return;
    }

    setSimulatingDelay(true);
    try {
      const response = await fetch("/api/bba-project/simulate-delay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: snapshot.activities,
          activityId: activity.id,
          delayDays: 3,
          asOfDate: snapshot.sCurve.at(-1)?.date ?? new Date().toISOString().slice(0, 10)
        })
      });

      const result = (await response.json()) as {
        criticalPath: { projectDurationDays: number; criticalActivityIds: ReadonlyArray<string> };
        hasDependencies: boolean;
      };

      setDelaySimulation({
        projectDurationDays: result.criticalPath.projectDurationDays,
        criticalActivityCount: result.criticalPath.criticalActivityIds.length,
        hasDependencies: result.hasDependencies
      });
    } finally {
      setSimulatingDelay(false);
    }
  }

  if (entryChoice === "pending") {
    return (
      <Card className="span-12 workspace-card bba-project-fade-in" title="BBA Project Studio">
        <div className="workspace-map-placeholder">
          <div className="workspace-map-placeholder__icon" aria-hidden="true">
            <Sparkles size={22} />
          </div>
          <p className="workspace-map-placeholder__text">Como deseja começar?</p>
          <div className="bba-project-entry-choice">
            <button className="bba-project-entry-option" onClick={() => void handleChooseDemo()} type="button">
              <Sparkles aria-hidden="true" size={20} />
              <span>Ver demonstração</span>
              <span className="bba-project-entry-option__caption">Carrega um cronograma de exemplo já pronto</span>
            </button>
            <button className="bba-project-entry-option" onClick={handleChooseImport} type="button">
              <UploadCloud aria-hidden="true" size={20} />
              <span>Importar meu planejamento</span>
              <span className="bba-project-entry-option__caption">Envie seu próprio arquivo de cronograma</span>
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "idle" || phase === "error") {
    return (
      <Card className="span-12 workspace-card bba-project-fade-in" title="Importar Planejamento">
        <div className="workspace-map-placeholder">
          <div className="workspace-map-placeholder__icon" aria-hidden="true">
            <UploadCloud size={22} />
          </div>
          <p className="workspace-map-placeholder__text">Importe seu planejamento</p>
          <p className="workspace-map-placeholder__caption">
            O arquivo pode conter cronograma, curva S, físico-financeiro, medições, percentuais ou valores — o BBA Project
            Studio identifica automaticamente o que for possível.
          </p>
          <p className="workspace-map-placeholder__caption">
            <strong>Fontes aceitas nesta fase:</strong> Microsoft Project XML (.xml) · Excel (.xlsx)
          </p>
          {errorMessage ? <p className="workspace-map-placeholder__caption">{errorMessage}</p> : null}
          <div className="bba-project-actions">
            <button className="bba-button bba-button--primary bba-button--sm" onClick={() => void handleChooseDemo()} type="button">
              <Sparkles size={16} /> Ver demonstração
            </button>
            <button
              className="bba-button bba-button--secondary bba-button--sm"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <FileUp size={16} /> Importar arquivo (.xml ou .xlsx)
            </button>
            <input
              accept=".xml,.xlsx"
              className="bba-project-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void runImport(file);
                }
                event.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "processing") {
    return (
      <Card className="span-12 workspace-card bba-project-fade-in" title="Importar Planejamento">
        <div className="workspace-map-placeholder">
          <div className="workspace-map-placeholder__icon bba-project-processing-icon" aria-hidden="true">
            <Clock size={22} />
          </div>
          <p className="workspace-map-placeholder__text">{PROCESSING_STEPS[processingStepIndex]}</p>
          <ProgressBar animated color="gold" value={((processingStepIndex + 1) / PROCESSING_STEPS.length) * 100} />
        </div>
      </Card>
    );
  }

  return (
    <BbaProjectReadyView
      advisorRef={advisorRef}
      delaySimulation={delaySimulation}
      onSelectActivity={setSelectedActivityId}
      onSimulateDelay={(activity) => void handleSimulateDelay(activity)}
      selectedActivityId={selectedActivityId}
      simulatingDelay={simulatingDelay}
      snapshot={snapshot as BbaProjectSnapshot}
    />
  );
}

function firstAtRiskActivityId(snapshot: BbaProjectSnapshot): string | null {
  const firstDecision = snapshot.decisions[0];
  const spatialObjectId = firstDecision?.evidence[0]?.sourceReference ?? null;
  const spatialObject = snapshot.spatialObjects.find((candidate) => candidate.id === spatialObjectId);
  const activityId = spatialObject === undefined ? null : activityIdFromSpatialObjectId(spatialObject.id);
  return activityId ?? snapshot.planningDataset.activities.find((activity) => !activity.isSummary)?.id ?? null;
}

interface BbaProjectReadyViewProps {
  readonly snapshot: BbaProjectSnapshot;
  readonly selectedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => void;
  readonly onSimulateDelay: (activity: BbaProjectPlanningActivity) => void;
  readonly simulatingDelay: boolean;
  readonly delaySimulation: DelaySimulation | null;
  readonly advisorRef: RefObject<HTMLDivElement>;
}

function BbaProjectReadyView({
  snapshot,
  selectedActivityId,
  onSelectActivity,
  onSimulateDelay,
  simulatingDelay,
  delaySimulation,
  advisorRef
}: BbaProjectReadyViewProps) {
  const planningActivities = snapshot.planningDataset.activities;
  const topLevelActivities = planningActivities.filter((activity) => activity.parentId === null);
  const criticalIds = new Set(snapshot.criticalPath.criticalActivityIds);
  const scheduleById = new Map(snapshot.activities.map((activity) => [activity.id, activity]));

  const riskActivities = snapshot.decisions
    .map((decision) => resolveActivityForDecision(snapshot, decision))
    .filter((activity): activity is BbaProjectPlanningActivity => activity !== null);

  const selectedActivity = planningActivities.find((activity) => activity.id === selectedActivityId) ?? null;
  const selectedSchedule = selectedActivity ? scheduleById.get(selectedActivity.id) ?? null : null;
  const selectedSpatialObject = selectedActivity
    ? snapshot.spatialObjects.find((object) => object.id === spatialObjectIdForActivity(selectedActivity.id))
    : undefined;
  const selectedFact = selectedSpatialObject ? snapshot.facts.find((fact) => fact.sourceReference === selectedSpatialObject.id) : undefined;
  const selectedDecision = selectedSpatialObject
    ? snapshot.decisions.find((decision) => decision.evidence[0]?.sourceReference === selectedSpatialObject.id)
    : undefined;
  const selectedRecommendation = selectedDecision
    ? snapshot.recommendations.find((recommendation) => recommendation.decisionId === selectedDecision.id)
    : undefined;

  const confidenceLevel = selectedFact ? String(selectedFact.metadata.spatialConfidenceLevel ?? "") : null;
  const warningCodes = Array.isArray(selectedFact?.metadata.spatialConfidenceWarningCodes)
    ? (selectedFact?.metadata.spatialConfidenceWarningCodes as string[])
    : [];

  const asOfDate = snapshot.sCurve.at(-1)?.date ?? null;
  const latestKnownPoint = [...snapshot.sCurve].reverse().find((point) => point.actualPercent !== null);
  const aggregateSeries = snapshot.planningDataset.periodSeries.find((series) => series.activityId === null) ?? null;
  const latestAggregatePoint = aggregateSeries ? [...aggregateSeries.points].reverse().find((point) => point.actualPercent !== null) : null;

  const plannedPercent = latestAggregatePoint ? roundMaybePercent(latestAggregatePoint.plannedPercent) : latestKnownPoint?.plannedPercent ?? null;
  const actualPercent = latestAggregatePoint ? roundMaybePercent(latestAggregatePoint.actualPercent) : latestKnownPoint?.actualPercent ?? null;

  const selectedIsCritical = selectedSchedule !== null && selectedSchedule !== undefined && criticalIds.has(selectedSchedule.id);

  const healthScore = computeHealthScore(snapshot);
  const heroNarrative = buildHeroNarrative(snapshot, selectedActivityId);
  const advisorNarrative = buildAdvisorNarrative({
    activity: selectedActivity,
    warningCodes,
    isCritical: selectedIsCritical,
    hasSchedule: selectedSchedule !== null && selectedSchedule !== undefined,
    recommendationSummary: selectedRecommendation?.summary ?? null
  });
  const reasoningSteps = buildReasoningChain(snapshot);

  const spatialModelObjects: SpatialModelObject[] = snapshot.spatialObjects.map((object) => {
    const fact = snapshot.facts.find((candidate) => candidate.sourceReference === object.id);
    const level = fact ? String(fact.metadata.spatialConfidenceLevel ?? "") : null;
    return {
      id: object.id,
      label: object.label,
      kind: object.kind,
      statusLevel: deriveSpatialModelStatus(level),
      confidenceLabel: fact ? `${level} (score ${fact.value}/100)` : "Sem dado disponível"
    };
  });

  const riskListItems: RiskListItem[] = riskActivities.map((activity) => {
    const spatialObjectId = spatialObjectIdForActivity(activity.id);
    const fact = snapshot.facts.find((candidate) => candidate.sourceReference === spatialObjectId);
    const level = fact ? String(fact.metadata.spatialConfidenceLevel ?? "—") : "—";
    return { activity, confidenceLabel: level, isCritical: criticalIds.has(activity.id) };
  });

  const executiveCardsData: ExecutiveCardsData = {
    durationDays: snapshot.criticalPath.projectDurationDays > 0 ? snapshot.criticalPath.projectDurationDays : null,
    activityCount: snapshot.summary.activityCount > 0 ? snapshot.summary.activityCount : planningActivities.length,
    riskCount: riskActivities.length,
    plannedPercent,
    actualPercent,
    confidenceLabel: confidenceLevel
  };

  const advisorStatus = riskActivities.length > 0 ? "🟡 Requer atenção" : "🟢 Sem pendências";
  const planningTypeLabel = PLANNING_TYPE_LABELS[snapshot.detectedPlanningType] ?? snapshot.detectedPlanningType;

  function scrollToAdvisor() {
    advisorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <BbaProjectHero healthScore={healthScore} narrative={heroNarrative} onViewAnalysis={scrollToAdvisor} />

      <BbaProjectExecutiveCards data={executiveCardsData} />

      <div className="span-12" ref={advisorRef}>
        <BbaProjectAdvisorNarrative
          decision={selectedDecision}
          fact={selectedFact}
          narrative={advisorNarrative}
          recommendation={selectedRecommendation}
          status={advisorStatus}
        />
      </div>

      <Card className="span-8 workspace-card bba-project-fade-in" title="Cronograma">
        <BbaProjectScheduleTable
          asOfDate={asOfDate}
          criticalIds={criticalIds}
          onSelectActivity={onSelectActivity}
          planningActivities={planningActivities}
          scheduleById={scheduleById}
          selectedActivityId={selectedActivityId}
          topLevelActivities={topLevelActivities}
        />
      </Card>

      <Card className="span-4 workspace-card bba-project-fade-in" title="Modelo Espacial">
        <BbaProjectSpatialModel objects={spatialModelObjects} onSelectObject={onSelectActivity} selectedObjectId={selectedSpatialObject?.id ?? null} />
        <p className="workspace-card__note">Preparado para integração futura com GIS real — mesmo contrato, implementação diferente.</p>
      </Card>

      <Card className="span-4 workspace-card bba-project-fade-in" title="Atividades em Risco">
        <BbaProjectRiskList
          items={riskListItems}
          onSelectActivity={onSelectActivity}
          selectedActivityId={selectedActivityId}
          totalActivityCount={planningActivities.filter((activity) => !activity.isSummary).length}
        />
      </Card>

      <Card className="span-8 workspace-card bba-project-fade-in" title="Painel Executivo">
        <dl className="workspace-fact-list">
          <div className="workspace-fact">
            <dt>Arquivo</dt>
            <dd>{snapshot.fileName}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Tipo de planejamento detectado</dt>
            <dd>{planningTypeLabel}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Quantidade de riscos</dt>
            <dd>{riskActivities.length}</dd>
          </div>
          {snapshot.planningDataset.financial ? (
            <div className="workspace-fact">
              <dt>Valor do contrato</dt>
              <dd>{formatCurrency(snapshot.planningDataset.financial.contractValue)}</dd>
            </div>
          ) : null}
        </dl>

        {snapshot.warnings.length > 0 ? (
          <div className="bba-project-limitation-note">
            <TriangleAlert aria-hidden="true" size={16} />
            <div>
              <p>{LIMITATION_NOTICE}</p>
              <ul>
                {snapshot.warnings.map((warning, index) => (
                  <li key={`${warning.code}-${index}`}>{warning.message}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {selectedActivity ? (
          <div className="bba-project-living-schedule">
            <p className="workspace-section-label">Living Schedule</p>
            <button
              className="bba-button bba-button--secondary bba-button--sm"
              disabled={simulatingDelay || selectedSchedule === null || selectedSchedule === undefined}
              onClick={() => onSimulateDelay(selectedActivity)}
              type="button"
            >
              <TimerReset size={14} /> Simular atraso de 3 dias
            </button>
            {selectedSchedule === null || selectedSchedule === undefined ? (
              <p className="workspace-card__note">Esta atividade não tem datas/duração — a simulação exige um cronograma detalhado.</p>
            ) : null}
            {delaySimulation ? (
              <p className="workspace-card__note">
                {delaySimulation.hasDependencies
                  ? `Duração do projeto recalculada: ${delaySimulation.projectDurationDays} dias (${delaySimulation.criticalActivityCount} atividades no caminho crítico).`
                  : "Impacto em caminho crítico exige dependências explícitas."}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="span-4 workspace-card bba-project-fade-in" title="Resumo do Arquivo">
        <dl className="workspace-fact-list">
          <div className="workspace-fact">
            <dt>Tipo de fonte</dt>
            <dd>{snapshot.sourceType === "ms-project-xml" ? "Microsoft Project XML" : "Excel"}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Itens reconhecidos</dt>
            <dd>{executiveCardsData.activityCount}</dd>
          </div>
        </dl>
      </Card>

      <BbaProjectReasoningChain steps={reasoningSteps} />
    </>
  );
}

function resolveActivityForDecision(
  snapshot: BbaProjectSnapshot,
  decision: BbaProjectSnapshot["decisions"][number]
): BbaProjectPlanningActivity | null {
  const activityId = activityIdFromDecision(decision);
  return activityId ? snapshot.planningDataset.activities.find((activity) => activity.id === activityId) ?? null : null;
}

function roundMaybePercent(value: number | null): number | null {
  return value === null ? null : Math.round(value <= 1.5 ? value * 100 : value);
}

function formatCurrency(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
