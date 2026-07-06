"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileUp, Sparkles, UploadCloud } from "lucide-react";
import { Card, DecisionInsightCard, ProgressBar, type DecisionInsightCardSection } from "@bba/ui";
import { PlaceholderSpatialMapView } from "@/components/geospatial/geospatial-map-view";
import type { SpatialMapObjectViewModel } from "@/components/geospatial/map-adapter";
import type { BbaProjectActivity, BbaProjectSnapshot } from "./bba-project-view-types";

/**
 * BBA Project — Sprint Zero. Único componente com estado desta tela.
 * Nenhum cálculo do BDOS acontece aqui: este componente só envia o XML
 * para `/api/bba-project/import` (que chama a Application Service real,
 * `@bba/bdos-core/services/bba-project-import`) e apresenta o snapshot
 * já pronto — exatamente o mesmo padrão de fronteira Server/Client já
 * usado pelo Geospatial Workspace.
 *
 * A revelação em etapas ("Lendo cronograma...", "Avaliando confiança
 * espacial..." etc.) é só ritmo de apresentação: o cálculo real do
 * BDOS é praticamente instantâneo para um cronograma deste tamanho.
 * Optamos por um tempo mínimo de exibição de poucos segundos, não por
 * um atraso artificial de 15 segundos — inflar isso além do necessário
 * seria teatro, não produto.
 */
const PROCESSING_STEPS = [
  "Lendo cronograma...",
  "Identificando dependências...",
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

type Phase = "idle" | "processing" | "ready" | "error";

export function BbaProjectWorkspaceExperience() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [processingStepIndex, setProcessingStepIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<BbaProjectSnapshot | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function runImport(xml: string) {
    setPhase("processing");
    setProcessingStepIndex(0);
    setErrorMessage(null);

    const stepTimer = window.setInterval(() => {
      setProcessingStepIndex((current) => Math.min(current + 1, PROCESSING_STEPS.length - 1));
    }, STEP_DURATION_MS);

    const minimumDisplay = wait(PROCESSING_STEPS.length * STEP_DURATION_MS);

    try {
      const [response] = await Promise.all([
        fetch("/api/bba-project/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xml })
        }),
        minimumDisplay
      ]);

      const result = (await response.json()) as BbaProjectSnapshot;

      if (!response.ok || result.activities.length === 0) {
        setPhase("error");
        setErrorMessage("Não foi possível importar este cronograma. Verifique se o arquivo é uma exportação XML válida do Microsoft Project.");
        return;
      }

      setSnapshot(result);
      setSelectedActivityId(firstAtRiskActivityId(result));
      setPhase("ready");
    } catch {
      setPhase("error");
      setErrorMessage("Falha de comunicação ao importar o cronograma.");
    } finally {
      window.clearInterval(stepTimer);
    }
  }

  async function handleLoadSample() {
    const response = await fetch("/samples/cronograma-exemplo.xml");
    const xml = await response.text();
    await runImport(xml);
  }

  async function handleFileSelected(file: File) {
    const xml = await file.text();
    await runImport(xml);
  }

  if (phase === "idle" || phase === "error") {
    return (
      <Card className="span-12 workspace-card" title="Importar Cronograma">
        <div className="workspace-map-placeholder">
          <div className="workspace-map-placeholder__icon" aria-hidden="true">
            <UploadCloud size={22} />
          </div>
          <p className="workspace-map-placeholder__text">Importe um cronograma real ou carregue um exemplo</p>
          <p className="workspace-map-placeholder__caption">
            Exportação XML do Microsoft Project (Arquivo → Salvar Como → XML) — não o arquivo binário .mpp.
          </p>
          {errorMessage ? <p className="workspace-map-placeholder__caption">{errorMessage}</p> : null}
          <div className="bba-project-actions">
            <button className="bba-button bba-button--primary bba-button--sm" onClick={handleLoadSample} type="button">
              <Sparkles size={16} /> Carregar cronograma de exemplo
            </button>
            <button
              className="bba-button bba-button--secondary bba-button--sm"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <FileUp size={16} /> Importar arquivo .xml
            </button>
            <input
              accept=".xml"
              className="bba-project-file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFileSelected(file);
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
      <Card className="span-12 workspace-card" title="Importar Cronograma">
        <div className="workspace-map-placeholder">
          <div className="workspace-map-placeholder__icon bba-project-processing-icon" aria-hidden="true">
            <Clock size={22} />
          </div>
          <p className="workspace-map-placeholder__text">{PROCESSING_STEPS[processingStepIndex]}</p>
          <ProgressBar
            animated
            color="gold"
            value={((processingStepIndex + 1) / PROCESSING_STEPS.length) * 100}
          />
        </div>
      </Card>
    );
  }

  return <BbaProjectReadyView snapshot={snapshot as BbaProjectSnapshot} selectedActivityId={selectedActivityId} onSelectActivity={setSelectedActivityId} />;
}

function firstAtRiskActivityId(snapshot: BbaProjectSnapshot): string | null {
  const firstDecision = snapshot.decisions[0];
  const spatialObjectId = firstDecision?.evidence[0]?.sourceReference ?? null;
  const spatialObject = snapshot.spatialObjects.find((candidate) => candidate.id === spatialObjectId);
  const activityId = spatialObject === undefined ? null : activityIdFromSpatialObjectId(spatialObject.id);
  return activityId ?? snapshot.activities.find((activity) => !activity.isSummary)?.id ?? null;
}

function activityIdFromSpatialObjectId(spatialObjectId: string): string | null {
  const prefix = "spatial-object:work-package:";
  return spatialObjectId.startsWith(prefix) ? spatialObjectId.slice(prefix.length) : null;
}

interface BbaProjectReadyViewProps {
  readonly snapshot: BbaProjectSnapshot;
  readonly selectedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => void;
}

function BbaProjectReadyView({ snapshot, selectedActivityId, onSelectActivity }: BbaProjectReadyViewProps) {
  const topLevelActivities = snapshot.activities.filter((activity) => activity.parentActivityId === null);
  const riskActivities = snapshot.decisions
    .map((decision) => resolveActivityForDecision(snapshot, decision))
    .filter((activity): activity is BbaProjectActivity => activity !== null);

  const selectedActivity = snapshot.activities.find((activity) => activity.id === selectedActivityId) ?? null;
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
    riskLevel: snapshot.decisions.some((decision) => decision.evidence[0]?.sourceReference === object.id)
      ? "attention"
      : "none"
  }));

  const confidenceLevel = selectedFact ? String(selectedFact.metadata.spatialConfidenceLevel ?? "") : null;
  const warningCodes = Array.isArray(selectedFact?.metadata.spatialConfidenceWarningCodes)
    ? (selectedFact?.metadata.spatialConfidenceWarningCodes as string[])
    : [];

  const asOfDate = snapshot.sCurve.at(-1)?.date ?? null;
  const latestKnownPoint = [...snapshot.sCurve].reverse().find((point) => point.actualPercent !== null);
  const isBehindSchedule =
    selectedActivity !== null &&
    selectedActivity.percentComplete < 100 &&
    asOfDate !== null &&
    selectedActivity.plannedEnd < asOfDate;

  const criticalIds = new Set(snapshot.criticalPath.criticalActivityIds);

  const sections: DecisionInsightCardSection[] = [
    {
      title: "Qual atividade está em risco?",
      placeholder: selectedActivity ? `${selectedActivity.code} — ${selectedActivity.name}` : "Nenhuma atividade selecionada."
    },
    {
      title: "O que está causando?",
      placeholder: warningCodes.length > 0
        ? warningCodes.map((code) => WARNING_CODE_LABELS[code] ?? code).join("; ") + "."
        : "Aguardando análise das causas."
    },
    {
      title: "Está atrasada?",
      placeholder: selectedActivity
        ? isBehindSchedule
          ? `Sim — planejada para terminar em ${selectedActivity.plannedEnd}, hoje com ${selectedActivity.percentComplete}% concluído.`
          : `Não, dentro do prazo planejado (${selectedActivity.plannedEnd}).`
        : "Selecione uma atividade."
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
      placeholder: selectedActivity
        ? criticalIds.has(selectedActivity.id)
          ? "Sim — qualquer atraso aqui atrasa o projeto inteiro."
          : "Não — esta atividade possui folga."
        : "Selecione uma atividade."
    }
  ];

  const advisorStatus = riskActivities.length > 0 ? "🟡 Requer atenção" : "🟢 Sem pendências";

  return (
    <>
      <Card className="span-8 workspace-card" title="Cronograma">
        <div className="bba-project-wbs-table">
          {topLevelActivities.map((parent) => (
            <BbaProjectWbsGroup
              key={parent.id}
              parent={parent}
              childActivities={snapshot.activities.filter((activity) => activity.parentActivityId === parent.id)}
              criticalIds={criticalIds}
              selectedActivityId={selectedActivityId}
              onSelectActivity={onSelectActivity}
              asOfDate={asOfDate}
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
          {riskActivities.length} de {snapshot.activities.filter((activity) => !activity.isSummary).length} atividades sem
          verificação espacial ainda.
        </p>
      </Card>

      <DecisionInsightCard
        className="span-8"
        engineLabel="BBA Project — Schedule Intelligence"
        message={[
          `Analisei ${snapshot.activities.filter((activity) => !activity.isSummary).length} atividades deste cronograma.`,
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
            <dd>{snapshot.criticalPath.projectDurationDays} dias</dd>
          </div>
          <div className="workspace-fact">
            <dt>Atividades no caminho crítico</dt>
            <dd>{snapshot.criticalPath.criticalActivityIds.length}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Planejado × Executado (hoje)</dt>
            <dd>
              {latestKnownPoint ? `${latestKnownPoint.plannedPercent}% × ${latestKnownPoint.actualPercent}%` : "—"}
            </dd>
          </div>
          <div className="workspace-fact">
            <dt>Quantidade de riscos</dt>
            <dd>{riskActivities.length}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}

interface BbaProjectWbsGroupProps {
  readonly parent: BbaProjectActivity;
  readonly childActivities: ReadonlyArray<BbaProjectActivity>;
  readonly criticalIds: ReadonlySet<string>;
  readonly selectedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => void;
  readonly asOfDate: string | null;
}

function BbaProjectWbsGroup({ parent, childActivities, criticalIds, selectedActivityId, onSelectActivity, asOfDate }: BbaProjectWbsGroupProps) {
  return (
    <div className="bba-project-wbs-group">
      <BbaProjectWbsRow
        activity={parent}
        isChild={false}
        isCritical={criticalIds.has(parent.id)}
        isSelected={parent.id === selectedActivityId}
        onSelectActivity={onSelectActivity}
        asOfDate={asOfDate}
      />
      {childActivities.map((child) => (
        <BbaProjectWbsRow
          activity={child}
          isChild
          isCritical={criticalIds.has(child.id)}
          isSelected={child.id === selectedActivityId}
          key={child.id}
          onSelectActivity={onSelectActivity}
          asOfDate={asOfDate}
        />
      ))}
    </div>
  );
}

interface BbaProjectWbsRowProps {
  readonly activity: BbaProjectActivity;
  readonly isChild: boolean;
  readonly isCritical: boolean;
  readonly isSelected: boolean;
  readonly onSelectActivity: (activityId: string) => void;
  readonly asOfDate: string | null;
}

function BbaProjectWbsRow({ activity, isChild, isCritical, isSelected, onSelectActivity, asOfDate }: BbaProjectWbsRowProps) {
  const isLate = !activity.isSummary && activity.percentComplete < 100 && asOfDate !== null && activity.plannedEnd < asOfDate;

  return (
    <button
      className={`bba-project-wbs-row${isChild ? " bba-project-wbs-row--child" : ""}${
        isSelected ? " bba-project-wbs-row--selected" : ""
      }`}
      onClick={() => onSelectActivity(activity.id)}
      type="button"
    >
      <span className="bba-project-wbs-code">{activity.code}</span>
      <span className="bba-project-wbs-name">
        {activity.isMilestone ? "◆ " : ""}
        {activity.name}
      </span>
      <span className="bba-project-wbs-dates">
        {activity.plannedStart} → {activity.plannedEnd}
      </span>
      <span className="bba-project-wbs-progress">
        <ProgressBar animated={false} color={isLate ? "red" : "gold"} value={activity.percentComplete} />
      </span>
      {isCritical ? <span className="bba-project-wbs-badge bba-project-wbs-badge--critical">Caminho Crítico</span> : null}
      {isLate ? (
        <span className="bba-project-wbs-badge bba-project-wbs-badge--late">
          <CheckCircle2 aria-hidden="true" size={12} /> Atrasada
        </span>
      ) : null}
    </button>
  );
}

function resolveActivityForDecision(snapshot: BbaProjectSnapshot, decision: BbaProjectSnapshot["decisions"][number]): BbaProjectActivity | null {
  const spatialObjectId = decision.evidence[0]?.sourceReference;
  const activityId = spatialObjectId ? activityIdFromSpatialObjectId(spatialObjectId) : null;
  return activityId ? snapshot.activities.find((activity) => activity.id === activityId) ?? null : null;
}

function spatialObjectIdForActivity(activityId: string): string {
  return `spatial-object:work-package:${activityId}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
