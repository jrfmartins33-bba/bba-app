"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  FileUp,
  Sparkles,
  TimerReset,
  TriangleAlert,
  UploadCloud
} from "lucide-react";
import { Card, DecisionInsightCard, ProgressBar, type DecisionInsightCardSection } from "@bba/ui";
import { PlaceholderSpatialMapView } from "@/components/geospatial/geospatial-map-view";
import type { SpatialMapObjectViewModel } from "@/components/geospatial/map-adapter";
import type {
  BbaProjectPlanningActivity,
  BbaProjectSnapshot
} from "./bba-project-view-types";

/**
 * BBA Project Studio — Sprint 1 (Planning Dataset Import + Living
 * Schedule, ver `packages/bdos-core/docs/BBA_PROJECT.md`). Único
 * componente com estado desta tela. Nenhum cálculo do BDOS acontece
 * aqui: este componente só envia o arquivo para
 * `/api/bba-project/import` (que chama `importPlanningSource`, a
 * Application Service real) e apresenta o snapshot já pronto.
 *
 * A revelação em etapas é só ritmo de apresentação: o cálculo real do
 * BDOS é praticamente instantâneo para um arquivo deste tamanho.
 */
const PROCESSING_STEPS = [
  "Lendo arquivo...",
  "Identificando estrutura de planejamento...",
  "Conectando ao mapa...",
  "Avaliando confiança espacial...",
  "Gerando recomendações..."
];

const STEP_DURATION_MS = 650;

const WARNING_CODE_LABELS: Record<string, string> = {
  no_current_geometry: "nenhuma geometria de campo registrada ainda",
  current_geometry_low_precision: "geometria atual com baixa precisão",
  single_geometry_version: "geometria nunca foi refinada por uma segunda medição",
  single_layer_attached: "apenas uma camada de dado anexada até agora",
  no_evidential_layer: "nenhuma evidência de campo anexada"
};

const PLANNING_TYPE_LABELS: Record<string, string> = {
  cronograma: "Cronograma",
  "curva-s": "Curva S",
  "fisico-financeiro": "Cronograma Físico-Financeiro",
  mixed: "Dados mistos",
  unknown: "Não identificado"
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  "ms-project-xml": "Microsoft Project XML",
  excel: "Excel"
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
      <Card className="span-12 workspace-card" title="BBA Project Studio">
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
      <Card className="span-12 workspace-card" title="Importar Planejamento">
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
      <Card className="span-12 workspace-card" title="Importar Planejamento">
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

function activityIdFromSpatialObjectId(spatialObjectId: string): string | null {
  const prefix = "spatial-object:work-package:";
  return spatialObjectId.startsWith(prefix) ? spatialObjectId.slice(prefix.length) : null;
}

function spatialObjectIdForActivity(activityId: string): string {
  return `spatial-object:work-package:${activityId}`;
}

interface BbaProjectReadyViewProps {
  readonly snapshot: BbaProjectSnapshot;
  readonly selectedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => void;
  readonly onSimulateDelay: (activity: BbaProjectPlanningActivity) => void;
  readonly simulatingDelay: boolean;
  readonly delaySimulation: DelaySimulation | null;
}

function BbaProjectReadyView({
  snapshot,
  selectedActivityId,
  onSelectActivity,
  onSimulateDelay,
  simulatingDelay,
  delaySimulation
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
  const selectedFact = selectedSpatialObject
    ? snapshot.facts.find((fact) => fact.sourceReference === selectedSpatialObject.id)
    : undefined;
  const selectedDecision = selectedSpatialObject
    ? snapshot.decisions.find((decision) => decision.evidence[0]?.sourceReference === selectedSpatialObject.id)
    : undefined;
  const selectedRecommendation = selectedDecision
    ? snapshot.recommendations.find((recommendation) => recommendation.decisionId === selectedDecision.id)
    : undefined;

  const mapObjects: SpatialMapObjectViewModel[] = snapshot.spatialObjects.map((object) => ({
    id: object.id,
    label: object.label,
    kind: object.kind,
    riskLevel: snapshot.decisions.some((decision) => decision.evidence[0]?.sourceReference === object.id) ? "attention" : "none"
  }));

  const confidenceLevel = selectedFact ? String(selectedFact.metadata.spatialConfidenceLevel ?? "") : null;
  const warningCodes = Array.isArray(selectedFact?.metadata.spatialConfidenceWarningCodes)
    ? (selectedFact?.metadata.spatialConfidenceWarningCodes as string[])
    : [];

  const asOfDate = snapshot.sCurve.at(-1)?.date ?? null;
  const latestKnownPoint = [...snapshot.sCurve].reverse().find((point) => point.actualPercent !== null);
  const aggregateSeries = snapshot.planningDataset.periodSeries.find((series) => series.activityId === null) ?? null;
  const latestAggregatePoint = aggregateSeries ? [...aggregateSeries.points].reverse().find((point) => point.actualPercent !== null) : null;

  const isBehindSchedule =
    selectedSchedule !== null &&
    selectedSchedule !== undefined &&
    selectedSchedule.percentComplete < 100 &&
    asOfDate !== null &&
    selectedSchedule.plannedEnd < asOfDate;

  const sections: DecisionInsightCardSection[] = [
    {
      title: "Qual atividade está em risco?",
      placeholder: selectedActivity ? `${selectedActivity.code} — ${selectedActivity.name}` : "Nenhuma atividade selecionada."
    },
    {
      title: "O que está causando?",
      placeholder:
        warningCodes.length > 0 ? warningCodes.map((code) => WARNING_CODE_LABELS[code] ?? code).join("; ") + "." : "Aguardando análise das causas."
    },
    {
      title: "Está atrasada?",
      placeholder:
        selectedSchedule === null || selectedSchedule === undefined
          ? "Este arquivo não trouxe datas de início/fim para esta atividade — impossível avaliar atraso por prazo."
          : isBehindSchedule
            ? `Sim — planejada para terminar em ${selectedSchedule.plannedEnd}, hoje com ${selectedSchedule.percentComplete}% concluído.`
            : `Não, dentro do prazo planejado (${selectedSchedule.plannedEnd}).`
    },
    {
      title: "Qual a confiança espacial?",
      placeholder: confidenceLevel && selectedFact ? `${confidenceLevel} (score ${selectedFact.value}/100).` : "Sem dado disponível."
    },
    {
      title: "Qual ação recomendada?",
      placeholder: selectedRecommendation?.summary ?? "Nenhuma recomendação pendente para esta atividade."
    },
    {
      title: "Está no caminho crítico?",
      placeholder:
        selectedSchedule === null || selectedSchedule === undefined
          ? "Sem datas/dependências explícitas, o caminho crítico não pôde ser calculado para esta atividade."
          : criticalIds.has(selectedSchedule.id)
            ? "Sim — qualquer atraso aqui atrasa o projeto inteiro."
            : "Não — esta atividade possui folga."
    }
  ];

  const advisorStatus = riskActivities.length > 0 ? "🟡 Requer atenção" : "🟢 Sem pendências";
  const sourceLabel = SOURCE_TYPE_LABELS[snapshot.sourceType] ?? snapshot.sourceType;
  const planningTypeLabel = PLANNING_TYPE_LABELS[snapshot.detectedPlanningType] ?? snapshot.detectedPlanningType;

  return (
    <>
      <Card className="span-12 workspace-card" title="Arquivo Importado">
        <dl className="workspace-fact-list">
          <div className="workspace-fact">
            <dt>Arquivo</dt>
            <dd>{snapshot.fileName}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Tipo de fonte</dt>
            <dd>{sourceLabel}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Tipo de planejamento detectado</dt>
            <dd>{planningTypeLabel}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Itens reconhecidos</dt>
            <dd>{snapshot.summary.activityCount > 0 ? snapshot.summary.activityCount : planningActivities.length}</dd>
          </div>
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
      </Card>

      <Card className="span-8 workspace-card" title="Cronograma">
        <div className="bba-project-wbs-table">
          {topLevelActivities.map((parent) => (
            <BbaProjectWbsGroup
              asOfDate={asOfDate}
              childActivities={planningActivities.filter((activity) => activity.parentId === parent.id)}
              criticalIds={criticalIds}
              key={parent.id}
              onSelectActivity={onSelectActivity}
              parent={parent}
              scheduleById={scheduleById}
              selectedActivityId={selectedActivityId}
            />
          ))}
        </div>
      </Card>

      <Card className="span-4 workspace-card" title="Mapa da Obra">
        <PlaceholderSpatialMapView objects={mapObjects} onSelectObject={onSelectActivity} selectedObjectId={selectedSpatialObject?.id ?? null} />
      </Card>

      <Card className="span-4 workspace-card" title="Atividades em Risco">
        <div className="workspace-layer-list">
          {riskActivities.length === 0 ? (
            <p className="workspace-card__description">Nenhuma atividade em risco no momento.</p>
          ) : (
            riskActivities.map((activity) => (
              <button
                className="workspace-layer workspace-layer--active workspace-layer--interactive"
                key={activity.id}
                onClick={() => onSelectActivity(activity.id)}
                type="button"
              >
                <AlertTriangle aria-hidden="true" className="workspace-layer__icon" size={16} />
                {activity.code} — {activity.name}
              </button>
            ))
          )}
        </div>
        <p className="workspace-card__note">
          {riskActivities.length} de {planningActivities.filter((activity) => !activity.isSummary).length} atividades sem
          verificação espacial ainda.
        </p>
      </Card>

      <DecisionInsightCard
        className="span-8"
        engineLabel="BBA Project Studio — Schedule Intelligence"
        message={[
          `Analisei ${planningActivities.filter((activity) => !activity.isSummary).length} itens deste ${planningTypeLabel.toLowerCase()}.`,
          riskActivities.length > 0
            ? `Encontrei ${riskActivities.length} ponto${riskActivities.length > 1 ? "s" : ""} que merece${riskActivities.length > 1 ? "m" : ""} sua atenção.`
            : "Nenhum ponto crítico foi identificado no momento."
        ]}
        sections={sections}
        status={advisorStatus}
      />

      <Card className="span-4 workspace-card" title="Painel Executivo">
        <dl className="workspace-fact-list">
          <div className="workspace-fact">
            <dt>Duração do projeto</dt>
            <dd>{snapshot.criticalPath.projectDurationDays > 0 ? `${snapshot.criticalPath.projectDurationDays} dias` : "—"}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Atividades no caminho crítico</dt>
            <dd>{snapshot.criticalPath.criticalActivityIds.length}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Curva S — Planejado × Executado</dt>
            <dd>
              {latestAggregatePoint
                ? `${formatPercent(latestAggregatePoint.plannedPercent)} × ${formatPercent(latestAggregatePoint.actualPercent)}`
                : latestKnownPoint
                  ? `${latestKnownPoint.plannedPercent}% × ${latestKnownPoint.actualPercent}%`
                  : "—"}
            </dd>
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
    </>
  );
}

interface BbaProjectWbsGroupProps {
  readonly parent: BbaProjectPlanningActivity;
  readonly childActivities: ReadonlyArray<BbaProjectPlanningActivity>;
  readonly criticalIds: ReadonlySet<string>;
  readonly scheduleById: ReadonlyMap<string, BbaProjectSnapshot["activities"][number]>;
  readonly selectedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => void;
  readonly asOfDate: string | null;
}

function BbaProjectWbsGroup({
  parent,
  childActivities,
  criticalIds,
  scheduleById,
  selectedActivityId,
  onSelectActivity,
  asOfDate
}: BbaProjectWbsGroupProps) {
  return (
    <div className="bba-project-wbs-group">
      <BbaProjectWbsRow
        activity={parent}
        asOfDate={asOfDate}
        isChild={false}
        isCritical={criticalIds.has(parent.id)}
        isSelected={parent.id === selectedActivityId}
        onSelectActivity={onSelectActivity}
        schedule={scheduleById.get(parent.id) ?? null}
      />
      {childActivities.map((child) => (
        <BbaProjectWbsRow
          activity={child}
          asOfDate={asOfDate}
          isChild
          isCritical={criticalIds.has(child.id)}
          isSelected={child.id === selectedActivityId}
          key={child.id}
          onSelectActivity={onSelectActivity}
          schedule={scheduleById.get(child.id) ?? null}
        />
      ))}
    </div>
  );
}

interface BbaProjectWbsRowProps {
  readonly activity: BbaProjectPlanningActivity;
  readonly schedule: BbaProjectSnapshot["activities"][number] | null;
  readonly isChild: boolean;
  readonly isCritical: boolean;
  readonly isSelected: boolean;
  readonly onSelectActivity: (activityId: string) => void;
  readonly asOfDate: string | null;
}

function BbaProjectWbsRow({ activity, schedule, isChild, isCritical, isSelected, onSelectActivity, asOfDate }: BbaProjectWbsRowProps) {
  const isLate = schedule !== null && schedule.percentComplete < 100 && asOfDate !== null && schedule.plannedEnd < asOfDate;
  const percent = schedule?.percentComplete ?? activity.percentActual ?? 0;

  return (
    <button
      className={`bba-project-wbs-row${isChild ? " bba-project-wbs-row--child" : ""}${isSelected ? " bba-project-wbs-row--selected" : ""}`}
      onClick={() => onSelectActivity(activity.id)}
      type="button"
    >
      <span className="bba-project-wbs-code">{activity.code}</span>
      <span className="bba-project-wbs-name">
        {activity.isMilestone ? "◆ " : ""}
        {activity.name}
      </span>
      <span className="bba-project-wbs-dates">
        {schedule ? `${schedule.plannedStart} → ${schedule.plannedEnd}` : "Sem datas na origem"}
      </span>
      <span className="bba-project-wbs-progress">
        <ProgressBar animated={false} color={isLate ? "red" : "gold"} value={percent} />
      </span>
      {isCritical ? <span className="bba-project-wbs-badge bba-project-wbs-badge--critical">Caminho Crítico</span> : null}
      {isLate ? (
        <span className="bba-project-wbs-badge bba-project-wbs-badge--late">
          <FileSpreadsheet aria-hidden="true" size={12} /> Atrasada
        </span>
      ) : null}
    </button>
  );
}

function resolveActivityForDecision(
  snapshot: BbaProjectSnapshot,
  decision: BbaProjectSnapshot["decisions"][number]
): BbaProjectPlanningActivity | null {
  const spatialObjectId = decision.evidence[0]?.sourceReference;
  const activityId = spatialObjectId ? activityIdFromSpatialObjectId(spatialObjectId) : null;
  return activityId ? snapshot.planningDataset.activities.find((activity) => activity.id === activityId) ?? null : null;
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value <= 1.5 ? value * 100 : value)}%`;
}

function formatCurrency(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
